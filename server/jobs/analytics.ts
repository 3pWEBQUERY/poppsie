import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { JobHandler, Periodic } from "./types";

/**
 * Stündliche Aggregation analytics_events → analytics_hourly (idempotenter Upsert).
 * Abgeschlossene Stunden werden neu berechnet, ab der letzten aggregierten Stunde minus
 * Sicherheitsfenster (verspätete Events). Die laufende Stunde liest die Statistik roh.
 */
const LOOKBACK_H = 3;
const BACKFILL_DAYS = 120;

export async function aggregateAnalytics() {
  const res = await db.execute<{ from: string }>(sql`
    SELECT coalesce(max(hour) - make_interval(hours => ${LOOKBACK_H}), now() - make_interval(days => ${BACKFILL_DAYS})) AS from
    FROM analytics_hourly`);
  const from = new Date(res.rows[0]?.from ?? Date.now() - BACKFILL_DAYS * 86400_000);
  const out = await db.execute(sql`
    INSERT INTO analytics_hourly (profile_id, hour, type, source, country, count, uniques)
    SELECT profile_id, date_trunc('hour', created_at) AS hour, type, source, coalesce(country, '') AS country,
           count(*)::int, count(DISTINCT coalesce(viewer_key, viewer_id::text, id::text))::int
    FROM analytics_events
    WHERE created_at >= date_trunc('hour', ${from.toISOString()}::timestamptz) AND created_at < date_trunc('hour', now())
    GROUP BY 1, 2, 3, 4, 5
    ON CONFLICT (profile_id, hour, type, source, country)
    DO UPDATE SET count = excluded.count, uniques = excluded.uniques`);
  return out.rowCount ?? 0;
}

export const handlers: Record<string, JobHandler> = {
  "analytics.aggregate": async () => {
    await aggregateAnalytics();
  },
};

export const periodic: Periodic[] = [{ name: "analytics.hourly", everyMs: 5 * 60_000, run: async () => void (await aggregateAnalytics()) }];
