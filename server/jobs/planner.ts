import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { scheduledActions } from "@/db/schema";
import { executeScheduled, PermanentError } from "@/lib/planner/execute";
import { MAX_ATTEMPTS } from "@/lib/planner/types";
import { notify } from "@/lib/notify";
import type { JobHandler, Periodic } from "./types";

/**
 * Planer-Executor: alle ~15 s fällige Aktionen holen (FOR UPDATE SKIP LOCKED), ausführen,
 * bei Fehlern mit Backoff erneut versuchen, nach 5 Versuchen „fehlgeschlagen“.
 */
type Row = typeof scheduledActions.$inferSelect;

async function claim(limit = 20): Promise<Row[]> {
  // Hängengebliebene Ausführungen (Absturz) zurücksetzen
  await db.execute(sql`UPDATE scheduled_actions SET status = 'scheduled' WHERE status = 'running' AND run_at < now() - interval '10 minutes'`);
  const res = await db.execute<{ id: string }>(sql`
    UPDATE scheduled_actions SET status = 'running', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM scheduled_actions WHERE status = 'scheduled' AND run_at <= now()
      ORDER BY run_at LIMIT ${limit} FOR UPDATE SKIP LOCKED
    ) RETURNING id`);
  const ids = res.rows.map((r) => r.id);
  if (!ids.length) return [];
  return db.query.scheduledActions.findMany({ where: (t, { inArray }) => inArray(t.id, ids) });
}

export async function runPlanner() {
  for (const row of await claim()) {
    try {
      const result = await executeScheduled(row);
      await db.update(scheduledActions).set({ status: "done", executedAt: new Date(), lastError: null, payload: { ...row.payload, result } }).where(eq(scheduledActions.id, row.id));
    } catch (err) {
      const message = String((err as Error)?.message ?? err).slice(0, 500);
      const final = err instanceof PermanentError || row.attempts >= MAX_ATTEMPTS;
      const backoffSec = Math.min(1800, 30 * 2 ** (row.attempts - 1));
      await db
        .update(scheduledActions)
        .set(final ? { status: "failed", lastError: message } : { status: "scheduled", lastError: message, runAt: new Date(Date.now() + backoffSec * 1000) })
        .where(eq(scheduledActions.id, row.id));
      console.error(`[planner] ${row.type} ${row.id} Versuch ${row.attempts} fehlgeschlagen: ${message}`);
      if (final) await notify(row.ownerId, { type: "planner_failed", title: "Geplante Aktion fehlgeschlagen", body: message, href: "/dashboard/planer" }).catch(() => {});
    }
  }
}

export const handlers: Record<string, JobHandler> = {};
export const periodic: Periodic[] = [{ name: "planner.execute", everyMs: 15_000, run: runPlanner }];
