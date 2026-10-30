import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, notifications } from "@/db/schema";
import { announce, displayName, inviteReview } from "@/lib/bookings/events";
import { fmtDateTime, fmtTime } from "@/lib/bookings/format";
import { getBookingSettings } from "@/lib/bookings/settings";
import { parseRange } from "@/lib/bookings/range";
import { publish } from "@/lib/realtime/publish";
import type { JobHandler, Periodic } from "./types";

/**
 * Buchungen im Hintergrund: Reservierungen freigeben, Anfragen ablaufen lassen,
 * Erinnerungen 24 h / 2 h vorher, Erledigt-Abfrage und automatischer Abschluss.
 */
const AUTO_COMPLETE_H = 72;

type Row = typeof bookings.$inferSelect;
const startOf = (b: Row) => parseRange(b.during)!.start;

async function tzOf(escortId: string, cache: Map<string, string>) {
  if (!cache.has(escortId)) cache.set(escortId, (await getBookingSettings(escortId)).timezone);
  return cache.get(escortId)!;
}

/** 30-Minuten-Reservierungen unbestätigter Anfragen freigeben. */
export async function releaseHolds() {
  const rows = await db
    .update(bookings)
    .set({ blocking: false, updatedAt: new Date() })
    .where(and(eq(bookings.status, "requested"), eq(bookings.blocking, true), lt(bookings.holdUntil, new Date())))
    .returning();
  for (const b of rows) await publish([b.escortId, b.memberId], { type: "booking.updated", bookingId: b.id, conversationId: b.conversationId });
  return rows.length;
}

/** Offene Anfragen, deren Termin begonnen hat, laufen ab. */
async function expireOpen() {
  const rows = await db
    .update(bookings)
    .set({ status: "expired", blocking: false, updatedAt: new Date() })
    .where(and(inArray(bookings.status, ["requested", "countered"]), sql`lower(${bookings.during}) < now()`))
    .returning();
  for (const b of rows) await announce(b, { actorId: b.escortId, system: "Anfrage abgelaufen" });
}

async function sendReminders() {
  const tzCache = new Map<string, string>();
  const due = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "confirmed"),
        sql`lower(${bookings.during}) > now()`,
        sql`(
          (${bookings.reminder24SentAt} IS NULL AND lower(${bookings.during}) <= now() + interval '24 hours')
          OR (${bookings.reminder2SentAt} IS NULL AND lower(${bookings.during}) <= now() + interval '2 hours')
        )`,
      ),
    )
    .limit(200);
  for (const b of due) {
    const start = startOf(b);
    const hoursLeft = (start.getTime() - Date.now()) / 3600_000;
    const short = hoursLeft <= 2;
    // Atomar markieren, damit keine doppelte Erinnerung entsteht
    const [claimed] = await db
      .update(bookings)
      .set(short ? { reminder2SentAt: new Date(), reminder24SentAt: b.reminder24SentAt ?? new Date() } : { reminder24SentAt: new Date() })
      .where(and(eq(bookings.id, b.id), short ? isNull(bookings.reminder2SentAt) : isNull(bookings.reminder24SentAt)))
      .returning();
    if (!claimed) continue;
    const tz = await tzOf(b.escortId, tzCache);
    const text = short ? `Erinnerung: Euer Termin beginnt um ${fmtTime(start, tz)} Uhr` : `Erinnerung: Termin am ${fmtDateTime(start, tz)}`;
    const [escortName, memberName] = [await displayName(b.escortId), await displayName(b.memberId)];
    await announce(claimed, {
      actorId: b.escortId,
      system: text,
      notify: [
        { userId: b.memberId, type: "booking_reminder", title: `${text} mit ${escortName}` },
        { userId: b.escortId, type: "booking_reminder", title: `${text} mit ${memberName}` },
      ],
    });
  }
}

/** Vergangene bestätigte Termine: Escort fragen, nach 72 h automatisch abschliessen. */
async function promptCompletion() {
  const past = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), sql`upper(${bookings.during}) < now()`))
    .limit(200);
  for (const b of past) {
    const end = parseRange(b.during)!.end;
    const href = `/dashboard/kalender?buchung=${b.id}`;
    if (Date.now() - end.getTime() > AUTO_COMPLETE_H * 3600_000) {
      const [done] = await db
        .update(bookings)
        .set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed")))
        .returning();
      if (done) {
        await announce(done, { actorId: b.escortId, system: "Termin automatisch als erledigt markiert" });
        await inviteReview(done, b.escortId);
      }
      continue;
    }
    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, b.escortId), eq(notifications.type, "booking_complete_prompt"), eq(notifications.href, href)))
      .limit(1);
    if (already) continue;
    const memberName = await displayName(b.memberId);
    await announce(b, {
      actorId: b.escortId,
      notify: [{ userId: b.escortId, type: "booking_complete_prompt", title: `Hat das Treffen mit ${memberName} stattgefunden?`, body: "Markiere den Termin als erledigt oder als nicht erschienen.", href }],
    });
  }
}

export async function bookingsTick() {
  await releaseHolds();
  await expireOpen();
  await sendReminders();
  await promptCompletion();
}

/** Manuell anstossbar, z. B. enqueue("bookings.tick"). */
export const handlers: Record<string, JobHandler> = { "bookings.tick": bookingsTick };
export const periodic: Periodic[] = [{ name: "bookings.tick", everyMs: 60_000, run: bookingsTick }];
