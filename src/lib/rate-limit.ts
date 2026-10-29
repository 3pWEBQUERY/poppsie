import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ApiError } from "@/lib/auth/guards";

/**
 * Fixed-Window-Limit in Postgres (funktioniert über mehrere Instanzen hinweg).
 * Gibt true zurück, wenn die Aktion erlaubt ist.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, count, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSec}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSec}) THEN now() ELSE rate_limits.window_start END
    RETURNING count`);
  return Number(res.rows[0]?.count ?? 0) <= limit;
}

export async function limitOrThrow(key: string, limit: number, windowSec: number, message = "Zu viele Versuche. Bitte warte einen Moment.") {
  if (!(await hit(key, limit, windowSec))) throw new ApiError("RATE_LIMITED", message);
}

/** Standardlimit für schreibende Endpunkte: 60 pro Minute und User. */
export function writeLimit(userId: string, action: string, limit = 60, windowSec = 60) {
  return limitOrThrow(`w:${action}:${userId}`, limit, windowSec);
}
