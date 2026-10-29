import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, escortProfiles, favorites, follows, media, scheduledActions, users } from "@/db/schema";
import { localDate, zonedToUtc, addDays } from "@/lib/bookings/format";
import { findCity } from "@/lib/geo/cities";
import { getOrCreateConversation, insertMessage } from "@/lib/messaging/core";
import { notifyMany } from "@/lib/notify";
import { createStory } from "@/lib/stories/create";
import { broadcastPayload, locationPayload, storyPayload } from "./types";

/**
 * Ausführung geplanter Aktionen (ohne next/headers, läuft im Worker).
 * PermanentError = kein erneuter Versuch sinnvoll (z. B. Medium gelöscht, Drosselung).
 */
export class PermanentError extends Error {}

type Row = typeof scheduledActions.$inferSelect;
const MAX_RECIPIENTS = 5000;

async function ownerInfo(ownerId: string) {
  const [u] = await db
    .select({ id: users.id, username: users.username, type: users.accountType, status: users.status, escortName: escortProfiles.displayName, clubName: clubProfiles.name, slug: clubProfiles.slug })
    .from(users)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .leftJoin(clubProfiles, eq(clubProfiles.userId, users.id))
    .where(eq(users.id, ownerId));
  if (!u || u.status !== "active") throw new PermanentError("Konto nicht aktiv");
  return { ...u, name: u.escortName || u.clubName || u.username, href: u.type === "club" ? `/club/${u.slug ?? u.username}` : `/escort/${u.username}` };
}

/** Gleichzeitig verwendet beim Planen: höchstens ein Broadcast pro Kalendertag (Zeitzone der Erstellerin). */
export async function broadcastOnSameDay(ownerId: string, runAt: Date, tz: string, excludeId?: string) {
  const day = localDate(runAt, tz);
  const from = zonedToUtc(day, 0, tz);
  const to = zonedToUtc(addDays(day, 1), 0, tz);
  const rows = await db
    .select({ id: scheduledActions.id })
    .from(scheduledActions)
    .where(
      and(
        eq(scheduledActions.ownerId, ownerId),
        eq(scheduledActions.type, "broadcast"),
        inArray(scheduledActions.status, ["scheduled", "running", "done"]),
        gte(scheduledActions.runAt, from),
        sql`${scheduledActions.runAt} < ${to.toISOString()}::timestamptz`,
        excludeId ? ne(scheduledActions.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function followerIds(ownerId: string) {
  const rows = await db.select({ id: follows.followerId }).from(follows).where(eq(follows.followeeId, ownerId)).limit(MAX_RECIPIENTS);
  return rows.map((r) => r.id);
}

async function recipients(ownerId: string, segment: string, region?: string) {
  let ids: string[];
  if (segment === "favorites") {
    ids = (await db.select({ id: favorites.userId }).from(favorites).where(eq(favorites.targetId, ownerId)).limit(MAX_RECIPIENTS)).map((r) => r.id);
  } else if (segment === "region") {
    const fans = [...new Set([...(await followerIds(ownerId)), ...(await db.select({ id: favorites.userId }).from(favorites).where(eq(favorites.targetId, ownerId))).map((r) => r.id)])];
    if (!fans.length || !region) return [];
    ids = (await db.select({ id: users.id }).from(users).where(and(inArray(users.id, fans), eq(users.region, region)))).map((r) => r.id);
  } else {
    ids = await followerIds(ownerId);
  }
  if (!ids.length) return [];
  // Nur aktive Konten, keine Blockierungen
  const ok = await db.execute<{ id: string }>(sql`
    SELECT u.id FROM users u WHERE u.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}) AND u.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = ${ownerId}) OR (b.blocker_id = ${ownerId} AND b.blocked_id = u.id))`);
  return ok.rows.map((r) => r.id);
}

async function runStory(row: Row) {
  const p = storyPayload.parse(row.payload);
  const [m] = await db.select({ id: media.id, ownerId: media.ownerId, status: media.status }).from(media).where(eq(media.id, p.mediaId));
  if (!m || m.ownerId !== row.ownerId) throw new PermanentError("Medium nicht mehr vorhanden");
  if (m.status === "rejected") throw new PermanentError("Medium wurde abgelehnt");
  if (m.status === "processing") throw new Error("Medium wird noch verarbeitet");
  const story = await createStory({ authorId: row.ownerId, mediaId: m.id, overlayText: p.overlayText || null });
  return { storyId: story.id };
}

async function runLocation(row: Row) {
  const p = locationPayload.parse(row.payload);
  const city = findCity(p.city);
  if (!city) throw new PermanentError(`Unbekannte Stadt: ${p.city}`);
  const owner = await ownerInfo(row.ownerId);
  if (owner.type !== "escort") throw new PermanentError("Standortwechsel nur für Escorts");
  await db.update(escortProfiles).set({ city: city.name, country: city.country, lat: city.lat, lng: city.lng, updatedAt: new Date() }).where(eq(escortProfiles.userId, row.ownerId));
  const ids = await recipients(row.ownerId, "followers");
  await notifyMany(ids, { type: "location", title: `${owner.name} ist jetzt in ${city.name}`, body: "Neuer Standort – schau auf ihrem Profil vorbei.", href: owner.href, actorId: row.ownerId });
  return { city: city.name, notified: ids.length };
}

async function runBroadcast(row: Row) {
  const p = broadcastPayload.parse(row.payload);
  if (await broadcastOnSameDay(row.ownerId, row.runAt, row.timezone, row.id)) throw new PermanentError("Pro Tag ist nur ein Broadcast möglich");
  const owner = await ownerInfo(row.ownerId);
  const ids = await recipients(row.ownerId, p.segment, p.region);
  for (const uid of ids) {
    const conv = await getOrCreateConversation(row.ownerId, uid);
    await insertMessage({ conversationId: conv.id, senderId: row.ownerId, type: "text", body: p.text });
  }
  await notifyMany(ids, { type: "broadcast", title: `Neue Nachricht von ${owner.name}`, body: p.text.slice(0, 120), href: "/dashboard/nachrichten", actorId: row.ownerId });
  return { recipients: ids.length };
}

export async function executeScheduled(row: Row) {
  if (row.type === "story") return runStory(row);
  if (row.type === "location") return runLocation(row);
  return runBroadcast(row);
}
