"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { availabilityExceptions, availabilityRules, bookingSettings } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { writeLimit } from "@/lib/rate-limit";

const settingsSchema = z.object({
  enabled: z.boolean(),
  acceptsIncall: z.boolean(),
  acceptsOutcall: z.boolean(),
  bufferMin: z.number().int().min(0).max(240),
  minLeadMin: z.number().int().min(0).max(10080),
  timezone: z.string().min(3).max(64),
  durations: z.array(z.object({ minutes: z.number().int().min(15).max(1440), price: z.number().int().min(0).max(100000) })).max(10),
});

async function escort() {
  const user = await requireUser({ complete: true, types: ["escort"] });
  await writeLimit(user.id, "booking-settings", 60, 60);
  return user;
}

export async function saveBookingSettings(input: z.input<typeof settingsSchema>) {
  return run(async () => {
    const user = await escort();
    const p = settingsSchema.parse(input);
    try {
      new Intl.DateTimeFormat("de-CH", { timeZone: p.timezone });
    } catch {
      throw new ApiError("INVALID", "Unbekannte Zeitzone");
    }
    if (p.enabled && p.durations.length === 0) throw new ApiError("INVALID", "Wähle mindestens eine buchbare Dauer");
    if (p.enabled && !p.acceptsIncall && !p.acceptsOutcall) throw new ApiError("INVALID", "Wähle Incall, Outcall oder beides");
    const unique = [...new Map(p.durations.map((d) => [d.minutes, d])).values()].sort((a, b) => a.minutes - b.minutes);
    const values = { ...p, durations: unique };
    await db.insert(bookingSettings).values({ userId: user.id, ...values }).onConflictDoUpdate({ target: bookingSettings.userId, set: values });
    revalidatePath("/dashboard/kalender");
    return { ok: true };
  });
}

const rulesSchema = z
  .array(z.object({ weekday: z.number().int().min(0).max(6), startMin: z.number().int().min(0).max(1440), endMin: z.number().int().min(0).max(1440) }))
  .max(50);

/** Wiederkehrende Verfügbarkeit komplett ersetzen. */
export async function saveAvailabilityRules(input: z.input<typeof rulesSchema>) {
  return run(async () => {
    const user = await escort();
    const rules = rulesSchema.parse(input);
    for (const r of rules) if (r.endMin <= r.startMin) throw new ApiError("INVALID", "Das Ende muss nach dem Beginn liegen");
    await db.transaction(async (tx) => {
      await tx.delete(availabilityRules).where(eq(availabilityRules.userId, user.id));
      if (rules.length) await tx.insert(availabilityRules).values(rules.map((r) => ({ ...r, userId: user.id })));
    });
    revalidatePath("/dashboard/kalender");
    return { count: rules.length };
  });
}

const exceptionSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["unavailable", "extra"]),
  startMin: z.number().int().min(0).max(1440).nullable(),
  endMin: z.number().int().min(0).max(1440).nullable(),
  note: z.string().trim().max(200).optional(),
});

export async function addAvailabilityException(input: z.input<typeof exceptionSchema>) {
  return run(async () => {
    const user = await escort();
    const p = exceptionSchema.parse(input);
    if (p.dateTo < p.dateFrom) throw new ApiError("INVALID", "Das Enddatum liegt vor dem Startdatum");
    if ((p.startMin === null) !== (p.endMin === null)) throw new ApiError("INVALID", "Bitte Beginn und Ende angeben");
    if (p.startMin !== null && p.endMin !== null && p.endMin <= p.startMin) throw new ApiError("INVALID", "Das Ende muss nach dem Beginn liegen");
    if (p.kind === "extra" && p.startMin === null) throw new ApiError("INVALID", "Zusatzzeiten brauchen Beginn und Ende");
    const [row] = await db
      .insert(availabilityExceptions)
      .values({ userId: user.id, dateFrom: p.dateFrom, dateTo: p.dateTo, kind: p.kind, startMin: p.startMin, endMin: p.endMin, note: p.note || null })
      .returning({ id: availabilityExceptions.id });
    revalidatePath("/dashboard/kalender");
    return { id: row!.id };
  });
}

export async function deleteAvailabilityException(id: string) {
  return run(async () => {
    const user = await escort();
    await db.delete(availabilityExceptions).where(and(eq(availabilityExceptions.id, z.uuid().parse(id)), eq(availabilityExceptions.userId, user.id)));
    revalidatePath("/dashboard/kalender");
    return { ok: true };
  });
}
