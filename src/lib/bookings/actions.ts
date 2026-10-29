"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { track } from "@/lib/analytics";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { insertMessage, getOrCreateConversation } from "@/lib/messaging/core";
import { notify } from "@/lib/notify";
import { writeLimit } from "@/lib/rate-limit";
import { canViewProfile } from "@/lib/visibility";
import { announce, displayName, inviteReview } from "./events";
import { durationLabel, fmtDateTime, fmtRange, localDate } from "./format";
import { getBookingView } from "./queries";
import { isOverlapError, toRange, parseRange } from "./range";
import { allowedActions, NEXT_STATUS, type BookingAction } from "./rules";
import { getAvailability, getBookingSettings, getBusy, slotsFor } from "./settings";
import { isSlotFree } from "./slots";
import type { BookingStatus } from "./types";

const TAKEN = "Dieser Termin ist inzwischen vergeben";
const HOLD_MIN = 30;

/** Freie Slots (öffentlich lesbar, aber nur für sichtbare Escorts). */
export async function fetchSlots(input: { escortId: string; durationMin: number; fromDate: string; days?: number; excludeBookingId?: string }) {
  return run(async () => {
    const p = z
      .object({ escortId: z.uuid(), durationMin: z.number().int().min(15).max(1440), fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.number().int().min(1).max(14).optional(), excludeBookingId: z.uuid().optional() })
      .parse(input);
    const viewer = await getSessionUser();
    const [escort] = await db.select().from(users).where(eq(users.id, p.escortId));
    if (!escort || escort.accountType !== "escort" || !(await canViewProfile(viewer, escort))) throw new ApiError("NOT_FOUND");
    if (viewer?.id !== escort.id && !(await getBookingSettings(escort.id)).enabled) throw new ApiError("INVALID", "Keine Online-Buchung möglich");
    return slotsFor(p.escortId, p.durationMin, p.fromDate, p.days ?? 7, { excludeBookingId: viewer?.id === escort.id ? p.excludeBookingId : undefined });
  });
}

/** Buchungskarte nach einem Echtzeit-Event neu laden. */
export async function fetchBooking(id: string) {
  return run(async () => {
    const user = await requireUser();
    const view = await getBookingView(z.uuid().parse(id), user.id);
    if (!view) throw new ApiError("NOT_FOUND");
    return view;
  });
}

const createSchema = z.object({
  escortId: z.uuid(),
  durationMin: z.number().int().min(15).max(1440),
  start: z.iso.datetime(),
  meetingType: z.enum(["incall", "outcall"]),
  message: z.string().trim().max(1000).optional(),
});

/** Buchungsanfrage: Slot wird 30 Minuten reserviert (blocking), DB-Constraint verhindert Überlappungen. */
export async function createBookingRequest(input: z.input<typeof createSchema>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    if (user.accountType !== "member") throw new ApiError("FORBIDDEN", "Nur Mitglieder können Termine anfragen");
    const p = createSchema.parse(input);
    await writeLimit(user.id, "booking-request", 10, 600);
    const [escort] = await db.select().from(users).where(eq(users.id, p.escortId));
    if (!escort || escort.accountType !== "escort" || !(await canViewProfile(user, escort))) throw new ApiError("NOT_FOUND");

    const settings = await getBookingSettings(escort.id);
    if (!settings.enabled) throw new ApiError("INVALID", "Diese Escort nimmt keine Online-Buchungen an");
    const duration = settings.durations.find((d) => d.minutes === p.durationMin);
    if (!duration) throw new ApiError("INVALID", "Diese Dauer ist nicht buchbar");
    if (p.meetingType === "incall" && !settings.acceptsIncall) throw new ApiError("INVALID", "Incall ist nicht möglich");
    if (p.meetingType === "outcall" && !settings.acceptsOutcall) throw new ApiError("INVALID", "Outcall ist nicht möglich");

    const [open] = await db
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.escortId, escort.id), eq(bookings.memberId, user.id), inArray(bookings.status, ["requested", "countered"]), eq(bookings.blocking, true)));
    if ((open?.n ?? 0) >= 2) throw new ApiError("INVALID", "Du hast bei ihr bereits offene Anfragen. Warte bitte auf ihre Antwort.");

    const start = new Date(p.start);
    const end = new Date(start.getTime() + p.durationMin * 60_000);
    const { rules, exceptions } = await getAvailability(escort.id, settings.timezone);
    const busy = await getBusy(escort.id, new Date(start.getTime() - 86400_000), new Date(end.getTime() + 86400_000));
    const free = isSlotFree({ timezone: settings.timezone, rules, exceptions, busy, bufferMin: settings.bufferMin, minLeadMin: settings.minLeadMin, durationMin: p.durationMin }, start, localDate(start, settings.timezone));
    if (!free) throw new ApiError("CONFLICT", TAKEN);

    let row: typeof bookings.$inferSelect;
    try {
      row = await db.transaction(async (tx) => {
        const [b] = await tx
          .insert(bookings)
          .values({
            escortId: escort.id,
            memberId: user.id,
            during: toRange(start, end),
            durationMin: p.durationMin,
            price: duration.price || null,
            meetingType: p.meetingType,
            message: p.message || null,
            status: "requested",
            blocking: true,
            holdUntil: new Date(Date.now() + HOLD_MIN * 60_000),
          })
          .returning();
        return b!;
      });
    } catch (err) {
      if (isOverlapError(err)) throw new ApiError("CONFLICT", TAKEN);
      throw err;
    }

    const conv = await getOrCreateConversation(user.id, escort.id);
    await db.update(bookings).set({ conversationId: conv.id }).where(eq(bookings.id, row.id));
    await insertMessage({ conversationId: conv.id, senderId: user.id, type: "booking_card", bookingId: row.id });
    const memberName = await displayName(user.id);
    await notify(escort.id, {
      type: "booking_request",
      title: "Neue Buchungsanfrage",
      body: `${memberName} fragt ${durationLabel(p.durationMin)} am ${fmtDateTime(start, settings.timezone)} an.`,
      href: "/dashboard/kalender",
      actorId: user.id,
    });
    await track(escort.id, "booking_request", { viewerId: user.id, source: "profile", refId: row.id });
    revalidatePath("/dashboard/kalender");
    return { bookingId: row.id, conversationId: conv.id };
  });
}

const SYSTEM_TEXT: Record<BookingAction, string> = {
  confirm: "Termin bestätigt",
  counter: "Gegenvorschlag gesendet",
  decline: "Anfrage abgelehnt",
  accept: "Gegenvorschlag angenommen – Termin bestätigt",
  reject_counter: "Gegenvorschlag abgelehnt",
  cancel: "Termin abgesagt",
  complete: "Termin als erledigt markiert",
  no_show: "Als „nicht erschienen“ markiert",
};

/** Statusänderung über die Buchungskarte. */
export async function changeBooking(input: { id: string; action: BookingAction; counterStart?: string }) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const p = z
      .object({ id: z.uuid(), action: z.enum(["confirm", "counter", "decline", "accept", "reject_counter", "cancel", "complete", "no_show"]), counterStart: z.iso.datetime().optional() })
      .parse(input);
    await writeLimit(user.id, "booking-change", 30, 60);
    const [b] = await db.select().from(bookings).where(eq(bookings.id, p.id));
    if (!b || (b.escortId !== user.id && b.memberId !== user.id)) throw new ApiError("NOT_FOUND");
    const during = parseRange(b.during)!;
    if (!allowedActions({ status: b.status as BookingStatus, start: during.start.toISOString(), escortId: b.escortId, memberId: b.memberId }, user.id).includes(p.action)) {
      throw new ApiError("INVALID", "Diese Aktion ist im aktuellen Status nicht möglich");
    }
    const settings = await getBookingSettings(b.escortId);
    const tz = settings.timezone;
    let patch: Partial<typeof bookings.$inferInsert> = { updatedAt: new Date() };
    let systemText = SYSTEM_TEXT[p.action];

    if (p.action === "counter") {
      if (!p.counterStart) throw new ApiError("INVALID", "Bitte wähle eine neue Zeit");
      const cs = new Date(p.counterStart);
      const ce = new Date(cs.getTime() + b.durationMin * 60_000);
      const days = await slotsFor(b.escortId, b.durationMin, localDate(cs, tz), 1, { excludeBookingId: b.id });
      if (!days[0]?.slots.some((s) => new Date(s.start).getTime() === cs.getTime())) throw new ApiError("CONFLICT", TAKEN);
      patch = { ...patch, status: "countered", counterDuring: toRange(cs, ce), blocking: false, holdUntil: null };
      systemText = `Gegenvorschlag: ${fmtRange(cs, ce, tz)}`;
    } else if (p.action === "accept") {
      const c = parseRange(b.counterDuring);
      if (!c || c.start.getTime() <= Date.now()) throw new ApiError("INVALID", "Der Gegenvorschlag ist nicht mehr gültig");
      patch = { ...patch, status: "confirmed", during: toRange(c.start, c.end), counterDuring: null, blocking: true, holdUntil: null };
      systemText = `${SYSTEM_TEXT.accept}: ${fmtRange(c.start, c.end, tz)}`;
    } else if (p.action === "confirm") {
      patch = { ...patch, status: "confirmed", blocking: true, holdUntil: null };
    } else if (p.action === "complete" || p.action === "no_show") {
      patch = { ...patch, status: NEXT_STATUS[p.action] };
    } else {
      patch = { ...patch, status: NEXT_STATUS[p.action], blocking: false, holdUntil: null };
    }

    let updated: typeof bookings.$inferSelect;
    try {
      updated = await db.transaction(async (tx) => {
        const [r] = await tx
          .update(bookings)
          .set(patch)
          .where(and(eq(bookings.id, b.id), eq(bookings.status, b.status)))
          .returning();
        if (!r) throw new ApiError("CONFLICT", "Die Buchung wurde inzwischen geändert");
        return r;
      });
    } catch (err) {
      if (isOverlapError(err)) throw new ApiError("CONFLICT", TAKEN);
      throw err;
    }

    const other = user.id === b.escortId ? b.memberId : b.escortId;
    const actorName = await displayName(user.id);
    await announce(updated, { actorId: user.id, system: systemText, notify: [{ userId: other, title: `${actorName}: ${systemText}`, body: fmtRange(parseRange(updated.during)!.start, parseRange(updated.during)!.end, tz) }] });
    if (p.action === "confirm" || p.action === "accept") await track(b.escortId, "booking_confirmed", { viewerId: b.memberId, refId: b.id });
    if (p.action === "complete") await inviteReview(updated, user.id);
    revalidatePath("/dashboard/kalender");
    const view = await getBookingView(b.id, user.id);
    return view!;
  });
}
