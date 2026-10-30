import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledActions } from "@/db/schema";
import { localDate, localMinutes } from "@/lib/bookings/format";
import type { PlannerItem, PlannerStatus, PlannerType } from "./types";

/** Alle geplanten Aktionen einer Anbieterin (lokale Zeit in ihrer Zeitzone). */
export async function listScheduled(ownerId: string): Promise<PlannerItem[]> {
  const rows = await db.select().from(scheduledActions).where(eq(scheduledActions.ownerId, ownerId)).orderBy(asc(scheduledActions.runAt)).limit(500);
  return rows.map((r) => ({
    id: r.id,
    type: r.type as PlannerType,
    payload: r.payload,
    runAt: r.runAt.toISOString(),
    timezone: r.timezone,
    status: r.status as PlannerStatus,
    attempts: r.attempts,
    lastError: r.lastError,
    executedAt: r.executedAt?.toISOString() ?? null,
    localDate: localDate(r.runAt, r.timezone),
    localMin: localMinutes(r.runAt, r.timezone),
  }));
}
