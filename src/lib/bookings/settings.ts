import { and, asc, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { availabilityExceptions, availabilityRules, bookingSettings, bookings, escortProfiles, users } from "@/db/schema";
import { DEFAULT_TZ, NIGHT_MIN, STANDARD_DURATIONS, addDays, localDate } from "./format";
import { parseRange } from "./range";
import { computeSlots, type Busy } from "./slots";
import type { BookingSettingsView, DaySlots } from "./types";

/** Buchungseinstellungen laden (ohne next/headers, auch im Worker nutzbar). */
export async function getBookingSettings(userId: string): Promise<BookingSettingsView & { exists: boolean }> {
  const [row] = await db.select().from(bookingSettings).where(eq(bookingSettings.userId, userId));
  if (row) {
    return {
      exists: true,
      timezone: row.timezone || DEFAULT_TZ,
      bufferMin: row.bufferMin,
      minLeadMin: row.minLeadMin,
      durations: [...row.durations].sort((a, b) => a.minutes - b.minutes),
      acceptsIncall: row.acceptsIncall,
      acceptsOutcall: row.acceptsOutcall,
      enabled: row.enabled,
    };
  }
  const [p] = await db
    .select({ prices: escortProfiles.prices, workplace: escortProfiles.workplace, tz: users.timezone })
    .from(users)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .where(eq(users.id, userId));
  const prices = p?.prices ?? [];
  // Vorbelegung aus den Profilpreisen
  const durations: { minutes: number; price: number }[] = STANDARD_DURATIONS.map((minutes: number) => ({ minutes, price: prices.find((x) => x.minutes === minutes)?.price ?? 0 })).filter(
    (d) => d.price > 0 || d.minutes !== NIGHT_MIN,
  );
  for (const x of prices) if (!durations.some((d) => d.minutes === x.minutes)) durations.push({ minutes: x.minutes, price: x.price });
  return {
    exists: false,
    timezone: p?.tz || DEFAULT_TZ,
    bufferMin: 15,
    minLeadMin: 60,
    durations: durations.sort((a, b) => a.minutes - b.minutes),
    acceptsIncall: p?.workplace !== "outcall",
    acceptsOutcall: p?.workplace === "outcall" || p?.workplace === "both",
    enabled: false,
  };
}

export async function getAvailability(userId: string, tz = DEFAULT_TZ) {
  const today = localDate(new Date(), tz);
  const rules = await db
    .select({ id: availabilityRules.id, weekday: availabilityRules.weekday, startMin: availabilityRules.startMin, endMin: availabilityRules.endMin })
    .from(availabilityRules)
    .where(eq(availabilityRules.userId, userId))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startMin));
  const exceptions = await db
    .select()
    .from(availabilityExceptions)
    .where(and(eq(availabilityExceptions.userId, userId), gte(availabilityExceptions.dateTo, today)))
    .orderBy(asc(availabilityExceptions.dateFrom));
  return { rules, exceptions };
}

/** Blockierende Buchungen im Zeitraum (für Slots). */
export async function getBusy(escortId: string, from: Date, to: Date, excludeId?: string): Promise<Busy[]> {
  const range = `[${from.toISOString()},${to.toISOString()})`;
  const rows = await db
    .select({ during: bookings.during })
    .from(bookings)
    .where(
      and(
        eq(bookings.escortId, escortId),
        eq(bookings.blocking, true),
        sql`${bookings.during} && ${range}::tstzrange`,
        excludeId ? ne(bookings.id, excludeId) : undefined,
      ),
    );
  return rows.map((r) => parseRange(r.during)).filter((r): r is Busy => r !== null);
}

/** Freie Slots einer Escort für eine Dauer ab einem lokalen Datum. */
export async function slotsFor(escortId: string, durationMin: number, fromDate: string, days: number, opts: { excludeBookingId?: string; now?: Date } = {}): Promise<DaySlots[]> {
  const settings = await getBookingSettings(escortId);
  const { rules, exceptions } = await getAvailability(escortId, settings.timezone);
  const from = new Date(`${addDays(fromDate, -1)}T00:00:00Z`);
  const to = new Date(`${addDays(fromDate, days + 2)}T00:00:00Z`);
  const busy = await getBusy(escortId, from, to, opts.excludeBookingId);
  return computeSlots({
    timezone: settings.timezone,
    rules,
    exceptions,
    busy,
    bufferMin: settings.bufferMin,
    minLeadMin: settings.minLeadMin,
    durationMin,
    fromDate,
    days,
    now: opts.now,
  });
}
