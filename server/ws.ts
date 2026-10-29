import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { Client, type Notification } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { userFromToken } from "@/lib/auth/token";
import { publish, REALTIME_CHANNEL, type RealtimeEvent } from "@/lib/realtime/publish";

/**
 * WebSocket-Server auf /ws (alle anderen Upgrades gehen an Next.js, z. B. HMR).
 * - Auth über das Session-Cookie pp_session.
 * - Ereignisse kommen über Postgres LISTEN/NOTIFY (Kanal poppsie_rt), damit mehrere App-Instanzen
 *   dieselben Ereignisse an ihre jeweils verbundenen Clients verteilen.
 * - Client → Server: { type: "typing", conversationId } und { type: "ping" }.
 * - Präsenz: last_seen_at beim Verbinden und alle 30 s; presence-Events nur bei show_online.
 * Läuft ausserhalb von Next: keine Module mit next/headers importieren.
 */

const HEARTBEAT_MS = 30_000;
/** Nach dem letzten Socket so lange warten, bevor "offline" gemeldet wird (Reload, andere Instanz). */
const OFFLINE_GRACE_MS = 40_000;
const TYPING_MIN_INTERVAL_MS = 2_000;
const MEMBER_CACHE_MS = 60_000;

type Sock = WebSocket & { userId: string; alive: boolean; typingAt: Map<string, number> };

const sockets = new Map<string, Set<Sock>>();
const showOnline = new Map<string, boolean>();
const offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();
const memberCache = new Map<string, { ids: string[]; at: number }>();

function parseCookies(header: string | undefined) {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

/** Schutz gegen Cross-Site-WebSocket-Hijacking: Origin muss zum Host (oder APP_URL) passen. */
function originAllowed(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return true; // Nicht-Browser-Clients (Tests, Server)
  try {
    const host = new URL(origin).host;
    if (host === req.headers.host || host === req.headers["x-forwarded-host"]) return true;
    if (process.env.APP_URL && host === new URL(process.env.APP_URL).host) return true;
  } catch {}
  return false;
}

function reject(socket: Duplex, status: number, text: string) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function sendTo(userId: string, data: string) {
  const set = sockets.get(userId);
  if (!set) return 0;
  let n = 0;
  for (const s of set) {
    if (s.readyState === WebSocket.OPEN) {
      s.send(data);
      n++;
    }
  }
  return n;
}

/* ---------------- Präsenz ---------------- */

async function touch(userIds: string[]) {
  if (userIds.length === 0) return;
  const res = await db.execute<{ id: string; show_online: boolean }>(
    sql`UPDATE users SET last_seen_at = now() WHERE id IN (${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)}) RETURNING id, show_online`,
  );
  // Einstellung "Online-Status zeigen" kann sich während der Verbindung ändern.
  for (const r of res.rows) if (sockets.has(r.id)) showOnline.set(r.id, r.show_online);
}

/** Chat-Partner, die das Präsenz-Event sehen dürfen (ohne Blockierungen). */
async function contacts(userId: string) {
  const res = await db.execute<{ id: string }>(sql`
    SELECT DISTINCT cm2.user_id AS id FROM conversation_members cm1
    JOIN conversation_members cm2 ON cm2.conversation_id = cm1.conversation_id AND cm2.user_id <> cm1.user_id
    WHERE cm1.user_id = ${userId}
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ${userId} AND b.blocked_id = cm2.user_id) OR (b.blocker_id = cm2.user_id AND b.blocked_id = ${userId}))`);
  return res.rows.map((r) => r.id);
}

async function announce(userId: string, online: boolean) {
  if (!showOnline.get(userId)) return;
  const to = await contacts(userId);
  await publish(to, { type: "presence", userId, online });
}

/** Beim Verbinden: alle noch nicht zugestellten Nachrichten an diesen User als zugestellt markieren. */
async function markDelivered(userId: string, messageId?: string) {
  const res = await db.execute<{ id: string; conversation_id: string; sender_id: string; delivered_at: Date }>(sql`
    UPDATE messages m SET delivered_at = now()
    FROM conversation_members cm
    WHERE cm.conversation_id = m.conversation_id AND cm.user_id = ${userId}
      AND m.sender_id <> ${userId} AND m.delivered_at IS NULL AND m.deleted_at IS NULL
      ${messageId ? sql`AND m.id = ${messageId}` : sql`AND m.created_at > now() - interval '30 days'`}
    RETURNING m.id, m.conversation_id, m.sender_id, m.delivered_at`);
  const groups = new Map<string, { sender: string; conv: string; ids: string[]; at: string }>();
  for (const r of res.rows) {
    const key = `${r.sender_id}:${r.conversation_id}`;
    const g = groups.get(key) ?? { sender: r.sender_id, conv: r.conversation_id, ids: [], at: new Date(r.delivered_at).toISOString() };
    g.ids.push(r.id);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    for (let i = 0; i < g.ids.length; i += 100) {
      await publish([g.sender], { type: "message.delivered", conversationId: g.conv, messageIds: g.ids.slice(i, i + 100), at: g.at });
    }
  }
}

function onConnected(s: Sock, user: { id: string; showOnline: boolean }) {
  showOnline.set(user.id, user.showOnline);
  const set = sockets.get(user.id) ?? new Set<Sock>();
  const first = set.size === 0;
  set.add(s);
  sockets.set(user.id, set);
  const pendingOffline = offlineTimers.get(user.id);
  if (pendingOffline) {
    clearTimeout(pendingOffline);
    offlineTimers.delete(user.id);
  }
  touch([user.id])
    .then(() => (first && !pendingOffline ? announce(user.id, true) : undefined))
    .then(() => markDelivered(user.id))
    .catch((err) => console.error("[ws] connect", err));
}

function onDisconnected(s: Sock) {
  const set = sockets.get(s.userId);
  if (!set) return;
  set.delete(s);
  if (set.size > 0) return;
  sockets.delete(s.userId);
  const userId = s.userId;
  const closedAt = new Date();
  touch([userId]).catch(() => {});
  offlineTimers.set(
    userId,
    setTimeout(async () => {
      offlineTimers.delete(userId);
      if (sockets.has(userId)) return;
      try {
        // Hat eine andere Instanz den User inzwischen "gesehen"? Dann bleibt er online.
        const res = await db.execute<{ seen: boolean }>(sql`SELECT last_seen_at > ${closedAt.toISOString()}::timestamptz + interval '1 second' AS seen FROM users WHERE id = ${userId}`);
        if (res.rows[0]?.seen) return;
        await announce(userId, false);
        showOnline.delete(userId);
      } catch (err) {
        console.error("[ws] offline", err);
      }
    }, OFFLINE_GRACE_MS),
  );
}

/* ---------------- Client-Nachrichten ---------------- */

async function membersOf(conversationId: string) {
  const hit = memberCache.get(conversationId);
  if (hit && Date.now() - hit.at < MEMBER_CACHE_MS) return hit.ids;
  const res = await db.execute<{ user_id: string }>(sql`SELECT user_id FROM conversation_members WHERE conversation_id = ${conversationId}`);
  const ids = res.rows.map((r) => r.user_id);
  memberCache.set(conversationId, { ids, at: Date.now() });
  if (memberCache.size > 5000) memberCache.delete(memberCache.keys().next().value!);
  return ids;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function onClientMessage(s: Sock, raw: string) {
  let msg: { type?: unknown; conversationId?: unknown };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.type === "ping") {
    s.send(JSON.stringify({ type: "pong" }));
    return;
  }
  if (msg.type === "typing" && typeof msg.conversationId === "string" && UUID.test(msg.conversationId)) {
    const conversationId = msg.conversationId;
    const last = s.typingAt.get(conversationId) ?? 0;
    if (Date.now() - last < TYPING_MIN_INTERVAL_MS) return;
    s.typingAt.set(conversationId, Date.now());
    if (s.typingAt.size > 50) s.typingAt.delete(s.typingAt.keys().next().value!);
    const members = await membersOf(conversationId);
    if (!members.includes(s.userId)) return;
    const others = members.filter((id) => id !== s.userId);
    await publish(others, { type: "typing", conversationId, userId: s.userId });
  }
}

/* ---------------- LISTEN poppsie_rt ---------------- */

function onNotify(n: Notification) {
  if (n.channel !== REALTIME_CHANNEL || !n.payload) return;
  let parsed: { to: string[]; event: RealtimeEvent };
  try {
    parsed = JSON.parse(n.payload);
  } catch {
    return;
  }
  const data = JSON.stringify(parsed.event);
  for (const userId of parsed.to ?? []) {
    const delivered = sendTo(userId, data);
    if (delivered > 0 && parsed.event.type === "message.new" && parsed.event.senderId !== userId) {
      markDelivered(userId, parsed.event.messageId).catch((err) => console.error("[ws] delivered", err));
    }
  }
}

function startListener() {
  let client: Client | null = null;
  let retry = 0;
  let stopped = false;
  const connect = async () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error("[ws] DATABASE_URL fehlt – keine Echtzeit-Ereignisse");
      return;
    }
    const needsSsl = /sslmode=require/.test(url) || /proxy\.rlwy\.net/.test(url);
    const c = new Client({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined, keepAlive: true });
    client = c;
    let failed = false;
    const fail = (err?: unknown) => {
      if (failed || stopped) return;
      failed = true;
      if (err) console.error("[ws] LISTEN-Verbindung verloren:", (err as Error).message ?? err);
      c.removeAllListeners("notification");
      c.end().catch(() => {});
      const delay = Math.min(30_000, 1000 * 2 ** retry++);
      setTimeout(connect, delay);
    };
    c.on("error", fail);
    c.on("end", () => fail(new Error("Verbindung beendet")));
    c.on("notification", onNotify);
    try {
      await c.connect();
      await c.query(`LISTEN ${REALTIME_CHANNEL}`);
      retry = 0;
    } catch (err) {
      fail(err);
    }
  };
  connect();
  // Keepalive-Abfrage: erkennt halb offene Verbindungen.
  const probe = setInterval(() => {
    client?.query("SELECT 1").catch(() => client?.emit("error", new Error("Probe fehlgeschlagen")));
  }, 60_000);
  probe.unref();
  return () => {
    stopped = true;
    clearInterval(probe);
    client?.end().catch(() => {});
  };
}

/* ---------------- Server ---------------- */

export function attachWebSocket(server: Server, fallback: (req: IncomingMessage, socket: Duplex, head: Buffer) => void) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const stopListener = startListener();

  server.on("upgrade", (req, socket, head) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname !== "/ws") return fallback(req, socket, head);
    socket.on("error", () => {});
    if (!originAllowed(req)) return reject(socket, 403, "Forbidden");
    const token = parseCookies(req.headers.cookie).pp_session;
    if (!token) return reject(socket, 401, "Unauthorized");
    userFromToken(token)
      .then((user) => {
        if (!user) return reject(socket, 401, "Unauthorized");
        wss.handleUpgrade(req, socket, head, (ws) => {
          const s = ws as Sock;
          s.userId = user.id;
          s.alive = true;
          s.typingAt = new Map();
          s.on("pong", () => (s.alive = true));
          s.on("message", (data) => {
            s.alive = true;
            onClientMessage(s, data.toString()).catch((err) => console.error("[ws] message", err));
          });
          s.on("close", () => onDisconnected(s));
          s.on("error", () => s.terminate());
          onConnected(s, user);
        });
      })
      .catch((err) => {
        console.error("[ws] auth", err);
        reject(socket, 500, "Internal Server Error");
      });
  });

  // Heartbeat: tote Sockets entfernen, Präsenz auffrischen.
  const heartbeat = setInterval(() => {
    for (const set of sockets.values()) {
      for (const s of set) {
        if (!s.alive) {
          s.terminate();
          continue;
        }
        s.alive = false;
        try {
          s.ping();
        } catch {}
      }
    }
    touch([...sockets.keys()]).catch((err) => console.error("[ws] touch", err));
  }, HEARTBEAT_MS);
  heartbeat.unref();

  server.on("close", () => {
    clearInterval(heartbeat);
    stopListener();
    wss.close();
  });
}
