import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Durchschnitt und Anzahl (ohne ausgeblendete Berichte) in escort_profiles bzw. club_profiles
 * neu berechnen. Ohne next/headers – auch von Moderation und Worker nutzbar.
 */
export async function recomputeRating(targetId: string) {
  const agg = sql`(SELECT coalesce(round(avg(rating)::numeric, 2), 0) FROM reviews WHERE target_id = ${targetId} AND NOT hidden)`;
  const cnt = sql`(SELECT count(*)::int FROM reviews WHERE target_id = ${targetId} AND NOT hidden)`;
  await db.execute(sql`UPDATE escort_profiles SET rating_avg = ${agg}, rating_count = ${cnt} WHERE user_id = ${targetId}`);
  await db.execute(sql`UPDATE club_profiles SET rating_avg = ${agg}, rating_count = ${cnt} WHERE user_id = ${targetId}`);
}
