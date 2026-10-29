import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { HANDLERS, PERIODIC } from "./jobs";

/**
 * Postgres-Job-Queue mit Retry (exponentielles Backoff). Pollt alle 10 s, damit geplante Aktionen
 * innerhalb einer Minute ausgeführt werden. Mehrere Instanzen sind dank SKIP LOCKED sicher.
 */
const POLL_MS = 10_000;

async function claimJobs(limit = 10) {
  const res = await db.execute<{ id: string; type: string; payload: Record<string, unknown>; attempts: number; max_attempts: number }>(sql`
    UPDATE jobs SET locked_at = now(), attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM jobs
      WHERE done_at IS NULL AND run_at <= now() AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes') AND attempts < max_attempts
      ORDER BY run_at LIMIT ${limit} FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts, max_attempts`);
  return res.rows;
}

async function runJobs() {
  for (const job of await claimJobs()) {
    const handler = HANDLERS[job.type];
    try {
      if (!handler) throw new Error(`Kein Handler für ${job.type}`);
      await handler(job.payload);
      await db.update(jobs).set({ doneAt: new Date(), lockedAt: null }).where(eq(jobs.id, job.id));
    } catch (err) {
      const backoff = Math.min(3600, 30 * 2 ** job.attempts);
      await db
        .update(jobs)
        .set({ lockedAt: null, lastError: String((err as Error).message ?? err).slice(0, 500), runAt: new Date(Date.now() + backoff * 1000) })
        .where(eq(jobs.id, job.id));
      console.error(`[worker] Job ${job.type} fehlgeschlagen (Versuch ${job.attempts})`, err);
    }
  }
}

const lastRun = new Map<string, number>();

async function runPeriodic() {
  const now = Date.now();
  for (const p of PERIODIC) {
    if (now - (lastRun.get(p.name) ?? 0) < p.everyMs) continue;
    lastRun.set(p.name, now);
    // Advisory-Lock, damit periodische Aufgaben nur auf einer Instanz laufen
    const lock = await db.execute<{ ok: boolean }>(sql`SELECT pg_try_advisory_lock(hashtext(${p.name})) AS ok`);
    if (!lock.rows[0]?.ok) continue;
    try {
      await p.run();
    } catch (err) {
      console.error(`[worker] ${p.name} fehlgeschlagen`, err);
    } finally {
      await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${p.name}))`);
    }
  }
}

export function startWorker() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runPeriodic();
      await runJobs();
    } catch (err) {
      console.error("[worker]", err);
    } finally {
      busy = false;
    }
  };
  setInterval(tick, POLL_MS);
  void tick();
  // Alte erledigte Jobs aufräumen
  setInterval(() => db.delete(jobs).where(and(lte(jobs.doneAt, new Date(Date.now() - 7 * 86400_000)))).catch(() => {}), 3600_000);
  console.log("> Job-Worker gestartet");
}
