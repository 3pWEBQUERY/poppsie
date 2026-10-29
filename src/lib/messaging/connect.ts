import { and, count, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blocks, bookings, conversations, escortProfiles, favorites, follows, reviews, users } from "@/db/schema";
import type { SendPermission } from "./types";

/**
 * Connect-Regeln (serverseitig durchgesetzt, ohne next/headers – auch für Profile/Buchungen nutzbar):
 * - Blockierte User können sich nicht schreiben.
 * - Escort mit Connect aus: Mitglieder schreiben nur mit Buchung (bestehende Chats bleiben lesbar).
 * - Feinsteuerung für neue Chats: nur verifizierte Mitglieder, nur mit Bericht, nur Follower/Favoriten.
 * - Erste Nachricht Mitglied → Escort ist eine Anfrage; max. 10 neue Anfragen pro Mitglied und Tag.
 */

export const REQUESTS_PER_DAY = 10;
const BOOKING_OK = ["requested", "countered", "confirmed", "completed"] as const;

type Party = { id: string; accountType: "member" | "escort" | "club"; kycStatus?: string };

export async function isBlockedEither(a: string, b: string) {
  const rows = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))))
    .limit(1);
  return rows.length > 0;
}

/** Gibt es eine (laufende oder erledigte) Buchung zwischen Mitglied und Escort? */
export async function hasBookingBetween(memberId: string, escortId: string) {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.memberId, memberId), eq(bookings.escortId, escortId), inArray(bookings.status, [...BOOKING_OK])))
    .limit(1);
  return rows.length > 0;
}

async function meetsRule(rule: string, member: Party, escortId: string) {
  if (rule === "verified") {
    if (member.kycStatus !== undefined) return member.kycStatus === "verified";
    const [u] = await db.select({ k: users.kycStatus }).from(users).where(eq(users.id, member.id));
    return u?.k === "verified";
  }
  if (rule === "with_review") {
    const [r] = await db.select({ n: count() }).from(reviews).where(and(eq(reviews.authorId, member.id), eq(reviews.hidden, false)));
    return (r?.n ?? 0) > 0;
  }
  if (rule === "followers") {
    const f = await db.select({ x: follows.followerId }).from(follows).where(and(eq(follows.followerId, member.id), eq(follows.followeeId, escortId))).limit(1);
    if (f.length) return true;
    const fav = await db.select({ x: favorites.userId }).from(favorites).where(and(eq(favorites.userId, member.id), eq(favorites.targetId, escortId))).limit(1);
    return fav.length > 0;
  }
  return true;
}

const RULE_TEXT: Record<string, string> = {
  verified: "Sie nimmt neue Chats nur von verifizierten Mitgliedern an.",
  with_review: "Sie nimmt neue Chats nur von Mitgliedern an, die mindestens einen Bericht geschrieben haben.",
  followers: "Sie nimmt neue Chats nur von Followern und Mitgliedern an, die sie als Favoritin gespeichert haben.",
};

/** Neue Anfragen eines Mitglieds in den letzten 24 Stunden. */
export async function requestsToday(memberId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(conversations)
    .where(and(eq(conversations.requestedBy, memberId), isNotNull(conversations.requestedBy), gt(conversations.createdAt, sql`now() - interval '1 day'`)));
  return r?.n ?? 0;
}

/**
 * Darf sender an recipient schreiben?
 * `isNewChat`: es gibt noch keine Konversation mit Nachrichten zwischen beiden.
 */
export async function checkSend(sender: Party, recipient: Party & { username: string; status: string }, opts: { isNewChat: boolean }): Promise<SendPermission> {
  if (sender.id === recipient.id) return { ok: false, code: "SELF", message: "Du kannst dir nicht selbst schreiben." };
  if (recipient.status !== "active") return { ok: false, code: "UNAVAILABLE", message: "Dieses Profil ist nicht mehr verfügbar." };
  if (await isBlockedEither(sender.id, recipient.id)) return { ok: false, code: "BLOCKED", message: "Ihr könnt euch keine Nachrichten schreiben." };

  if (sender.accountType !== "member" || recipient.accountType !== "escort") return { ok: true, isNewRequest: false };

  const [ep] = await db
    .select({ enabled: escortProfiles.connectEnabled, rule: escortProfiles.connectRule })
    .from(escortProfiles)
    .where(eq(escortProfiles.userId, recipient.id));
  const bookingHref = `/escort/${recipient.username}/buchen`;
  const booked = await hasBookingBetween(sender.id, recipient.id);
  if (ep && !ep.enabled && !booked) {
    return { ok: false, code: "CONNECT_OFF", message: "Kontakt nur über Buchung", bookingHref };
  }
  if (!opts.isNewChat) return { ok: true, isNewRequest: false };
  if (!booked && ep && ep.rule !== "all" && !(await meetsRule(ep.rule, sender, recipient.id))) {
    return { ok: false, code: "CONNECT_RULE", message: RULE_TEXT[ep.rule] ?? "Sie nimmt gerade keine neuen Chats an.", bookingHref };
  }
  if (booked) return { ok: true, isNewRequest: false };
  if ((await requestsToday(sender.id)) >= REQUESTS_PER_DAY) {
    return { ok: false, code: "REQUEST_LIMIT", message: `Du kannst höchstens ${REQUESTS_PER_DAY} neue Anfragen pro Tag senden. Versuche es morgen wieder.` };
  }
  return { ok: true, isNewRequest: true };
}

/**
 * Für den Connect-Button auf Profilen: Darf der Betrachter einen Chat mit dieser Person öffnen?
 * Liefert dieselbe Entscheidung wie beim Senden (ohne Anfrage-Limit, das greift erst beim Senden).
 */
export async function connectState(viewer: Party, target: Party & { username: string; status: string }) {
  const [hasChat] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM conversation_members a
    JOIN conversation_members b ON b.conversation_id = a.conversation_id AND b.user_id = ${target.id}
    JOIN messages m ON m.conversation_id = a.conversation_id
    WHERE a.user_id = ${viewer.id}`).then((r) => r.rows);
  const res = await checkSend(viewer, target, { isNewChat: !(hasChat && hasChat.n > 0) });
  if (!res.ok && res.code === "REQUEST_LIMIT") return { ok: true as const, isNewRequest: true };
  return res;
}
