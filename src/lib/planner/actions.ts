"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { media, scheduledActions } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { zonedToUtc } from "@/lib/bookings/format";
import { findCity } from "@/lib/geo/cities";
import { writeLimit } from "@/lib/rate-limit";
import { broadcastOnSameDay } from "./execute";
import { broadcastPayload, locationPayload, storyPayload } from "./types";

const baseSchema = z.object({
  type: z.enum(["story", "location", "broadcast"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().min(0).max(1439),
  payload: z.record(z.string(), z.unknown()),
});

function issue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Ungültige Eingabe";
}

async function validate(user: { id: string; accountType: string; timezone: string }, input: z.input<typeof baseSchema>, excludeId?: string) {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) throw new ApiError("INVALID", issue(parsed.error));
  const p = parsed.data;
  const tz = user.timezone || "Europe/Zurich";
  const runAt = zonedToUtc(p.date, p.minutes, tz);
  if (runAt.getTime() < Date.now() - 60_000) throw new ApiError("INVALID", "Der Zeitpunkt liegt in der Vergangenheit");
  if (runAt.getTime() > Date.now() + 180 * 86400_000) throw new ApiError("INVALID", "Höchstens 180 Tage im Voraus planbar");

  let payload: Record<string, unknown>;
  if (p.type === "story") {
    const s = storyPayload.safeParse(p.payload);
    if (!s.success) throw new ApiError("INVALID", "Bitte lade ein Bild oder Video hoch");
    const [m] = await db.select({ ownerId: media.ownerId, purpose: media.purpose }).from(media).where(eq(media.id, s.data.mediaId));
    if (!m || m.ownerId !== user.id || m.purpose !== "story") throw new ApiError("INVALID", "Medium nicht gefunden");
    payload = s.data;
  } else if (p.type === "location") {
    if (user.accountType !== "escort") throw new ApiError("FORBIDDEN", "Standortwechsel gibt es nur für Escorts");
    const s = locationPayload.safeParse(p.payload);
    if (!s.success || !findCity(s.data.city)) throw new ApiError("INVALID", "Bitte wähle eine Stadt");
    payload = { city: findCity(s.data.city)!.name };
  } else {
    const s = broadcastPayload.safeParse(p.payload);
    if (!s.success) throw new ApiError("INVALID", issue(s.error));
    if (s.data.segment === "region" && !s.data.region) throw new ApiError("INVALID", "Bitte wähle eine Region");
    if (await broadcastOnSameDay(user.id, runAt, tz, excludeId)) throw new ApiError("CONFLICT", "Pro Tag ist nur eine Nachricht an Follower möglich");
    payload = s.data;
  }
  return { type: p.type, runAt, tz, payload };
}

export async function createScheduled(input: z.input<typeof baseSchema>) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["escort", "club"] });
    await writeLimit(user.id, "planner", 30, 3600);
    const v = await validate(user, input);
    const [row] = await db.insert(scheduledActions).values({ ownerId: user.id, type: v.type, payload: v.payload, runAt: v.runAt, timezone: v.tz }).returning({ id: scheduledActions.id });
    revalidatePath("/dashboard/planer");
    return { id: row!.id };
  });
}

/** Bearbeiten bis zur Ausführung (setzt Versuche und Fehler zurück). */
export async function updateScheduled(id: string, input: z.input<typeof baseSchema>) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["escort", "club"] });
    await writeLimit(user.id, "planner", 30, 3600);
    z.uuid().parse(id);
    const v = await validate(user, input, id);
    const [row] = await db
      .update(scheduledActions)
      .set({ type: v.type, payload: v.payload, runAt: v.runAt, timezone: v.tz, attempts: 0, lastError: null, status: "scheduled" })
      .where(and(eq(scheduledActions.id, id), eq(scheduledActions.ownerId, user.id), eq(scheduledActions.status, "scheduled")))
      .returning({ id: scheduledActions.id });
    if (!row) throw new ApiError("CONFLICT", "Diese Aktion wurde bereits ausgeführt");
    revalidatePath("/dashboard/planer");
    return { id: row.id };
  });
}

/** Löschen bis zur Ausführung; ausgeführte/fehlgeschlagene Einträge dürfen aus der Liste entfernt werden. */
export async function deleteScheduled(id: string) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["escort", "club"] });
    await writeLimit(user.id, "planner", 60, 3600);
    const [row] = await db
      .delete(scheduledActions)
      .where(and(eq(scheduledActions.id, z.uuid().parse(id)), eq(scheduledActions.ownerId, user.id), ne(scheduledActions.status, "running")))
      .returning({ status: scheduledActions.status });
    if (!row) throw new ApiError("NOT_FOUND");
    revalidatePath("/dashboard/planer");
    return { ok: true };
  });
}
