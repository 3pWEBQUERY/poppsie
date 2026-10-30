import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, escortProfiles, users } from "@/db/schema";
import { getOrCreateConversation, insertMessage } from "@/lib/messaging/core";
import { notify } from "@/lib/notify";
import { publish } from "@/lib/realtime/publish";

/**
 * Nebenwirkungen nach Statusänderungen (ohne next/headers, auch im Worker nutzbar):
 * Echtzeit-Update an beide, Systemnachricht im Chat, Benachrichtigung.
 */
type BookingRow = typeof bookings.$inferSelect;

export async function ensureConversation(b: BookingRow) {
  if (b.conversationId) return b.conversationId;
  const conv = await getOrCreateConversation(b.memberId, b.escortId);
  await db.update(bookings).set({ conversationId: conv.id }).where(eq(bookings.id, b.id));
  return conv.id;
}

export async function announce(
  b: BookingRow,
  opts: {
    actorId: string;
    system?: string;
    notify?: { userId: string; type?: string; title: string; body?: string; href?: string }[];
  },
) {
  if (opts.system) {
    const conversationId = await ensureConversation(b);
    await insertMessage({ conversationId, senderId: opts.actorId, type: "system", body: opts.system });
  }
  for (const n of opts.notify ?? []) {
    await notify(n.userId, { type: n.type ?? "booking", title: n.title, body: n.body, href: n.href ?? "/dashboard/kalender", actorId: opts.actorId });
  }
  await publish([b.escortId, b.memberId], { type: "booking.updated", bookingId: b.id, conversationId: b.conversationId });
}

/** Anzeigename (Escort-Name oder Benutzername). */
export async function displayName(userId: string) {
  const [r] = await db
    .select({ username: users.username, name: escortProfiles.displayName })
    .from(users)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .where(eq(users.id, userId));
  return r?.name || r?.username || "Jemand";
}

export async function usernameOf(userId: string) {
  const [r] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
  return r?.username ?? "";
}

/** Nach „Erledigt“: Mitglied zum Bericht einladen. */
export async function inviteReview(b: BookingRow, actorId: string) {
  if (b.reviewInvitedAt) return;
  const escortUsername = await usernameOf(b.escortId);
  const name = await displayName(b.escortId);
  await db.update(bookings).set({ reviewInvitedAt: new Date() }).where(eq(bookings.id, b.id));
  await notify(b.memberId, {
    type: "review_invite",
    title: `Wie war dein Treffen mit ${name}?`,
    body: "Schreib einen Bericht – er erhält das Label „Verifiziertes Treffen“.",
    href: `/escort/${escortUsername}/bericht?buchung=${b.id}`,
    actorId,
  });
}
