import "server-only";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blocks, conversationMembers, conversations, media, messageAttachments, messages, reactions, users } from "@/db/schema";
import { getBookingViews } from "@/lib/bookings/queries";
import { mediaUrl } from "@/lib/media/urls";
import { getSummaries } from "@/lib/users/summary";
import { checkSend } from "./connect";
import { conversationMemberIds } from "./core";
import {
  ONLINE_WINDOW_MS,
  type AttachmentKind,
  type AttachmentView,
  type ConversationItem,
  type MessageView,
  type PartnerView,
  type ReactionView,
  type ThreadMeta,
  type ThreadPage,
} from "./types";

type Viewer = { id: string; accountType: "member" | "escort" | "club"; kycStatus: string; readReceipts: boolean };

const PAGE_SIZE = 30;

const KIND_PREVIEW: Record<AttachmentKind, string> = { image: "📷 Foto", video: "🎬 Video", audio: "🎤 Sprachnachricht", file: "📄 Datei" };

export function previewText(m: { type: string; body: string | null; deletedAt: Date | string | null; kind?: AttachmentKind | null }) {
  if (m.deletedAt) return "Nachricht gelöscht";
  if (m.type === "booking_card") return "📅 Buchung";
  const body = (m.body ?? "").replace(/\s+/g, " ").trim();
  if (body) return body.slice(0, 120);
  if (m.kind) return KIND_PREVIEW[m.kind];
  return "";
}

/* ---------------- Personen ---------------- */

export async function getPartners(ids: string[], viewer: { id: string }): Promise<Map<string, PartnerView>> {
  const out = new Map<string, PartnerView>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  const [summaries, presence] = await Promise.all([
    getSummaries(unique, viewer),
    db.select({ id: users.id, showOnline: users.showOnline, lastSeenAt: users.lastSeenAt }).from(users).where(inArray(users.id, unique)),
  ]);
  const p = new Map(presence.map((r) => [r.id, r]));
  for (const id of unique) {
    const s = summaries.get(id);
    if (!s) continue;
    const pr = p.get(id);
    const visible = Boolean(pr?.showOnline);
    const seen = visible && pr?.lastSeenAt ? pr.lastSeenAt : null;
    out.set(id, {
      id,
      username: s.username,
      name: s.name,
      accountType: s.accountType,
      avatarUrl: s.avatarUrl,
      href: s.href,
      verified: s.verified,
      online: seen ? Date.now() - seen.getTime() < ONLINE_WINDOW_MS : false,
      lastSeenAt: seen ? seen.toISOString() : null,
    });
  }
  return out;
}

/* ---------------- Konversationsliste ---------------- */

type ListRow = {
  id: string;
  is_request: boolean;
  requested_by: string | null;
  last_message_at: Date;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  partner_id: string | null;
  lm_body: string | null;
  lm_type: string;
  lm_sender: string;
  lm_deleted: Date | null;
  lm_kind: AttachmentKind | null;
  unread: number;
  blocked: boolean;
};

export async function listConversations(viewer: Viewer, opts: { ids?: string[]; search?: string } = {}): Promise<ConversationItem[]> {
  const idFilter = opts.ids?.length ? sql`AND c.id IN (${sql.join(opts.ids.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``;
  const q = opts.search?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : "";
  const searchFilter = q
    ? sql`AND (EXISTS (SELECT 1 FROM messages sm WHERE sm.conversation_id = c.id AND sm.deleted_at IS NULL AND sm.body ILIKE ${like})
        OR EXISTS (SELECT 1 FROM conversation_members sc JOIN users su ON su.id = sc.user_id
          LEFT JOIN escort_profiles se ON se.user_id = su.id LEFT JOIN club_profiles sk ON sk.user_id = su.id
          WHERE sc.conversation_id = c.id AND sc.user_id <> ${viewer.id}
            AND (su.username ILIKE ${like} OR se.display_name ILIKE ${like} OR sk.name ILIKE ${like})))`
    : sql``;
  const res = await db.execute<ListRow>(sql`
    SELECT c.id, c.is_request, c.requested_by, c.last_message_at, cm.pinned, cm.archived, cm.muted,
      (SELECT o.user_id FROM conversation_members o WHERE o.conversation_id = c.id AND o.user_id <> ${viewer.id} LIMIT 1) AS partner_id,
      lm.body AS lm_body, lm.type AS lm_type, lm.sender_id AS lm_sender, lm.deleted_at AS lm_deleted,
      (SELECT md.kind FROM message_attachments ma JOIN media md ON md.id = ma.media_id WHERE ma.message_id = lm.id LIMIT 1) AS lm_kind,
      (SELECT count(*) FROM messages um WHERE um.conversation_id = c.id AND um.sender_id <> ${viewer.id} AND um.deleted_at IS NULL
        AND (cm.last_read_at IS NULL OR um.created_at > cm.last_read_at))::int AS unread,
      EXISTS (SELECT 1 FROM blocks b JOIN conversation_members o2 ON o2.conversation_id = c.id AND o2.user_id <> ${viewer.id}
        WHERE (b.blocker_id = ${viewer.id} AND b.blocked_id = o2.user_id) OR (b.blocker_id = o2.user_id AND b.blocked_id = ${viewer.id})) AS blocked
    FROM conversation_members cm
    JOIN conversations c ON c.id = cm.conversation_id
    JOIN LATERAL (SELECT m.id, m.body, m.type, m.sender_id, m.deleted_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) lm ON true
    WHERE cm.user_id = ${viewer.id} ${idFilter} ${searchFilter}
    ORDER BY cm.pinned DESC, c.last_message_at DESC
    LIMIT 300`);
  const rows = res.rows;
  const partners = await getPartners(rows.map((r) => r.partner_id).filter((x): x is string => Boolean(x)), viewer);
  const items: ConversationItem[] = [];
  for (const r of rows) {
    const partner = r.partner_id ? partners.get(r.partner_id) : undefined;
    if (!partner) continue;
    const preview = previewText({ type: r.lm_type, body: r.lm_body, deletedAt: r.lm_deleted, kind: r.lm_kind });
    items.push({
      id: r.id,
      partner,
      preview: r.lm_sender === viewer.id && preview ? `Du: ${preview}` : preview,
      lastSenderId: r.lm_sender,
      lastMessageAt: new Date(r.last_message_at).toISOString(),
      unread: Number(r.unread),
      pinned: r.pinned,
      archived: r.archived,
      muted: r.muted,
      incomingRequest: r.is_request && r.requested_by !== null && r.requested_by !== viewer.id,
      outgoingRequest: r.is_request && r.requested_by === viewer.id,
      blocked: r.blocked,
    });
  }
  return items;
}

/* ---------------- Nachrichten ---------------- */

type MessageRow = typeof messages.$inferSelect;

/** Rohdaten → Ansicht inkl. Anhängen, Reaktionen, Zitat und Buchungskarte. */
export async function assembleMessages(rows: MessageRow[], viewerId: string): Promise<MessageView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const replyIds = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x)))];
  const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter((x): x is string => Boolean(x)))];

  const [atts, reacts, replies, bookingViews] = await Promise.all([
    db
      .select({
        messageId: messageAttachments.messageId,
        mediaId: media.id,
        viewOnce: messageAttachments.viewOnce,
        viewedAt: messageAttachments.viewedAt,
        kind: media.kind,
        mime: media.mime,
        fileName: media.fileName,
        durationSec: media.durationSec,
        width: media.width,
        height: media.height,
        thumbKey: media.thumbKey,
        status: media.status,
      })
      .from(messageAttachments)
      .innerJoin(media, eq(media.id, messageAttachments.mediaId))
      .where(inArray(messageAttachments.messageId, ids)),
    db
      .select({ targetId: reactions.targetId, userId: reactions.userId, emoji: reactions.emoji, createdAt: reactions.createdAt })
      .from(reactions)
      .where(and(eq(reactions.targetType, "message"), inArray(reactions.targetId, ids)))
      .orderBy(reactions.createdAt),
    replyIds.length
      ? db
          .select({
            id: messages.id,
            senderId: messages.senderId,
            body: messages.body,
            type: messages.type,
            deletedAt: messages.deletedAt,
            kind: sql<AttachmentKind | null>`(SELECT md.kind FROM message_attachments ma JOIN media md ON md.id = ma.media_id WHERE ma.message_id = ${messages.id} LIMIT 1)`,
          })
          .from(messages)
          .where(inArray(messages.id, replyIds))
      : Promise.resolve([]),
    bookingIds.length ? getBookingViews(bookingIds, viewerId) : Promise.resolve(new Map()),
  ]);

  const senderOf = new Map(rows.map((r) => [r.id, r.senderId]));
  const attByMsg = new Map<string, AttachmentView[]>();
  for (const a of atts) {
    if (a.status === "rejected") continue;
    const mine = senderOf.get(a.messageId) === viewerId;
    const viewed = Boolean(a.viewedAt);
    const hidden = a.viewOnce && !mine; // Empfänger: keine Vorschau, Original nur bis zum ersten Öffnen
    const thumbUrl = hidden ? null : a.kind === "image" ? mediaUrl(a.mediaId, "t") : a.kind === "video" && a.thumbKey ? mediaUrl(a.mediaId, "t") : null;
    const url = hidden && viewed ? null : mediaUrl(a.mediaId, "o");
    const list = attByMsg.get(a.messageId) ?? [];
    list.push({
      mediaId: a.mediaId,
      kind: a.kind,
      mime: a.mime,
      fileName: a.fileName,
      durationSec: a.durationSec,
      width: a.width,
      height: a.height,
      viewOnce: a.viewOnce,
      viewed,
      thumbUrl,
      url,
    });
    attByMsg.set(a.messageId, list);
  }

  const reactByMsg = new Map<string, ReactionView[]>();
  for (const r of reacts) {
    if (!r.emoji) continue;
    const list = reactByMsg.get(r.targetId) ?? [];
    let entry = list.find((x) => x.emoji === r.emoji);
    if (!entry) {
      entry = { emoji: r.emoji, count: 0, mine: false, userIds: [] };
      list.push(entry);
    }
    entry.count++;
    entry.userIds.push(r.userId);
    if (r.userId === viewerId) entry.mine = true;
    reactByMsg.set(r.targetId, list);
  }

  const replyMap = new Map(replies.map((r) => [r.id, r]));

  return rows.map((r) => {
    const deleted = Boolean(r.deletedAt);
    const rep = r.replyToId ? replyMap.get(r.replyToId) : undefined;
    return {
      id: r.id,
      conversationId: r.conversationId,
      senderId: r.senderId,
      type: r.type,
      body: deleted ? null : r.body,
      createdAt: r.createdAt.toISOString(),
      editedAt: r.editedAt?.toISOString() ?? null,
      deletedAt: r.deletedAt?.toISOString() ?? null,
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
      replyTo: rep && !deleted ? { id: rep.id, senderId: rep.senderId, preview: previewText(rep), deleted: Boolean(rep.deletedAt) } : null,
      attachments: deleted ? [] : (attByMsg.get(r.id) ?? []),
      reactions: deleted ? [] : (reactByMsg.get(r.id) ?? []),
      bookingId: r.bookingId,
      booking: r.bookingId ? (bookingViews.get(r.bookingId) ?? null) : null,
    };
  });
}

function parseCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  const [at, id] = cursor.split("|");
  const d = new Date(at ?? "");
  if (!id || Number.isNaN(d.getTime()) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { at: d, id };
}

/** Neueste zuerst laden; Rückgabe chronologisch. nextCursor zeigt auf ältere Nachrichten. */
export async function getMessagesPage(conversationId: string, viewerId: string, cursor?: string | null): Promise<ThreadPage> {
  const c = parseCursor(cursor);
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        c ? or(lt(messages.createdAt, c.at), and(eq(messages.createdAt, c.at), lt(messages.id, c.id))) : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(PAGE_SIZE + 1);
  const more = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const views = await assembleMessages(page.reverse(), viewerId);
  return { messages: views, nextCursor: more && last ? `${last.createdAt.toISOString()}|${last.id}` : null };
}

export async function getMessageViews(conversationId: string, ids: string[], viewerId: string) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), inArray(messages.id, ids)))
    .orderBy(messages.createdAt);
  return assembleMessages(rows, viewerId);
}

/* ---------------- Thread-Kopf ---------------- */

async function hasMessages(conversationId: string) {
  const r = await db.select({ id: messages.id }).from(messages).where(eq(messages.conversationId, conversationId)).limit(1);
  return r.length > 0;
}

export async function getTargetUser(id: string) {
  const [u] = await db
    .select({ id: users.id, username: users.username, accountType: users.accountType, status: users.status, kycStatus: users.kycStatus, readReceipts: users.readReceipts })
    .from(users)
    .where(eq(users.id, id));
  return u ?? null;
}

/** Kopf- und Berechtigungsdaten eines Threads. conversationId null = neuer Chat (Entwurf). */
export async function getThreadMeta(viewer: Viewer, partnerId: string, conversationId: string | null): Promise<ThreadMeta | null> {
  const target = await getTargetUser(partnerId);
  if (!target) return null;
  const partner = (await getPartners([partnerId], viewer)).get(partnerId);
  if (!partner) return null;
  const [mine, theirs, conv, blockedByMe] = await Promise.all([
    conversationId
      ? db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)))
      : Promise.resolve([]),
    conversationId
      ? db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, partnerId)))
      : Promise.resolve([]),
    conversationId ? db.select().from(conversations).where(eq(conversations.id, conversationId)) : Promise.resolve([]),
    db.select({ x: blocks.blockerId }).from(blocks).where(and(eq(blocks.blockerId, viewer.id), eq(blocks.blockedId, partnerId))).limit(1),
  ]);
  const me = mine[0];
  const c = conv[0];
  const receipts = viewer.readReceipts && target.readReceipts;
  const isNewChat = !conversationId || !(await hasMessages(conversationId));
  const canSend = await checkSend(viewer, target, { isNewChat });
  return {
    conversationId,
    partner,
    // Solange eine Anfrage offen ist, sieht die anfragende Person keine Lesebestätigung.
    partnerLastReadAt: receipts && !(c?.isRequest && c.requestedBy === viewer.id) ? (theirs[0]?.lastReadAt?.toISOString() ?? null) : null,
    receipts,
    canSend,
    incomingRequest: Boolean(c?.isRequest && c.requestedBy && c.requestedBy !== viewer.id),
    outgoingRequest: Boolean(c?.isRequest && c.requestedBy === viewer.id),
    blockedByMe: blockedByMe.length > 0,
    pinned: me?.pinned ?? false,
    archived: me?.archived ?? false,
    muted: me?.muted ?? false,
  };
}

export async function partnerOf(conversationId: string, viewerId: string) {
  const ids = await conversationMemberIds(conversationId);
  if (!ids.includes(viewerId)) return null;
  return ids.find((id) => id !== viewerId) ?? null;
}
