import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bounds, bucketKeys, bucketLabel, type Period, type Unit } from "./period";

/**
 * Statistik-Abfragen. Ereignis-Zahlen kommen aus analytics_hourly (abgeschlossene, aggregierte Stunden)
 * plus Rohereignissen danach (laufende Stunde bzw. noch nicht aggregiert). Eindeutige Besucher
 * werden aus Rohereignissen gezählt, da sie über Stunden nicht addierbar sind.
 */
export type SeriesPoint = { key: string; label: string; value: number; prev: number };
export type Breakdown = { key: string; value: number; prev: number }[];

const TYPES = [
  "profile_view",
  "search_impression",
  "search_click",
  "story_view",
  "story_like",
  "story_comment",
  "favorite_add",
  "follow",
  "chat_start",
  "booking_request",
  "booking_confirmed",
] as const;
export type EventType = (typeof TYPES)[number];

type Range = { from: Date; to: Date };

/** Vereinigung aus Aggregat (bis zur letzten aggregierten Stunde) und Rohereignissen danach. */
function events(profileId: string, r: Range): SQL {
  const cut = sql`(SELECT coalesce(max(hour) + interval '1 hour', '-infinity'::timestamptz) FROM analytics_hourly WHERE profile_id = ${profileId})`;
  return sql`(
    SELECT hour AS t, type::text AS type, source::text AS source, country, count AS n FROM analytics_hourly
    WHERE profile_id = ${profileId} AND hour >= ${r.from.toISOString()}::timestamptz AND hour < least(${r.to.toISOString()}::timestamptz, ${cut})
    UNION ALL
    SELECT created_at, type::text, source::text, coalesce(country, ''), 1 FROM analytics_events
    WHERE profile_id = ${profileId} AND created_at >= greatest(${r.from.toISOString()}::timestamptz, ${cut}) AND created_at < ${r.to.toISOString()}::timestamptz
  )`;
}

const bucket = (col: SQL, unit: Unit, tz: string) => sql`to_char(date_trunc(${unit}, ${col} AT TIME ZONE ${tz}), 'YYYY-MM-DD')`;

async function totals(profileId: string, r: Range) {
  const res = await db.execute<{ type: string; n: number }>(sql`SELECT type, sum(n)::int AS n FROM ${events(profileId, r)} e GROUP BY type`);
  const map = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<EventType, number>;
  for (const row of res.rows) map[row.type as EventType] = Number(row.n);
  return map;
}

async function seriesByType(profileId: string, r: Range, unit: Unit, tz: string) {
  const res = await db.execute<{ k: string; type: string; n: number }>(sql`
    SELECT ${bucket(sql`e.t`, unit, tz)} AS k, type, sum(n)::int AS n FROM ${events(profileId, r)} e GROUP BY 1, 2`);
  const out = new Map<string, Map<string, number>>();
  for (const row of res.rows) {
    if (!out.has(row.type)) out.set(row.type, new Map());
    out.get(row.type)!.set(row.k, Number(row.n));
  }
  return out;
}

async function uniqueSeries(profileId: string, r: Range, unit: Unit, tz: string) {
  const res = await db.execute<{ k: string; n: number }>(sql`
    SELECT ${bucket(sql`created_at`, unit, tz)} AS k, count(DISTINCT coalesce(viewer_key, viewer_id::text))::int AS n
    FROM analytics_events WHERE profile_id = ${profileId} AND type = 'profile_view'
      AND created_at >= ${r.from.toISOString()}::timestamptz AND created_at < ${r.to.toISOString()}::timestamptz
    GROUP BY 1`);
  const total = await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT coalesce(viewer_key, viewer_id::text))::int AS n FROM analytics_events
    WHERE profile_id = ${profileId} AND type = 'profile_view' AND created_at >= ${r.from.toISOString()}::timestamptz AND created_at < ${r.to.toISOString()}::timestamptz`);
  return { byKey: new Map(res.rows.map((x) => [x.k, Number(x.n)])), total: Number(total.rows[0]?.n ?? 0) };
}

async function breakdown(profileId: string, r: Range, field: "source" | "country") {
  const res = await db.execute<{ k: string; n: number }>(sql`
    SELECT ${sql.raw(field)} AS k, sum(n)::int AS n FROM ${events(profileId, r)} e WHERE type = 'profile_view' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`);
  return new Map(res.rows.map((x) => [x.k || "", Number(x.n)]));
}

async function regions(profileId: string, r: Range) {
  const res = await db.execute<{ k: string; n: number }>(sql`
    SELECT coalesce(e.region, u.region) AS k, count(*)::int AS n FROM analytics_events e
    LEFT JOIN users u ON u.id = e.viewer_id
    WHERE e.profile_id = ${profileId} AND e.type = 'profile_view' AND coalesce(e.region, u.region) IS NOT NULL
      AND e.created_at >= ${r.from.toISOString()}::timestamptz AND e.created_at < ${r.to.toISOString()}::timestamptz
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12`);
  return new Map(res.rows.map((x) => [x.k, Number(x.n)]));
}

function merge(cur: Map<string, number>, prev: Map<string, number>): Breakdown {
  const keys = [...new Set([...cur.keys(), ...prev.keys()])];
  return keys.map((key) => ({ key, value: cur.get(key) ?? 0, prev: prev.get(key) ?? 0 })).sort((a, b) => b.value - a.value);
}

/** Zuwachs (kumuliert) aus Tabellen mit created_at, z. B. Favoriten und Follower. */
async function growth(table: "favorites" | "follows", col: "target_id" | "followee_id", profileId: string, r: Range, unit: Unit, tz: string) {
  const t = sql.raw(table);
  const c = sql.raw(col);
  const before = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ${t} WHERE ${c} = ${profileId} AND created_at < ${r.from.toISOString()}::timestamptz`);
  const res = await db.execute<{ k: string; n: number }>(sql`
    SELECT ${bucket(sql`created_at`, unit, tz)} AS k, count(*)::int AS n FROM ${t}
    WHERE ${c} = ${profileId} AND created_at >= ${r.from.toISOString()}::timestamptz AND created_at < ${r.to.toISOString()}::timestamptz GROUP BY 1`);
  return { base: Number(before.rows[0]?.n ?? 0), byKey: new Map(res.rows.map((x) => [x.k, Number(x.n)])) };
}

async function bookingRate(profileId: string, r: Range) {
  const res = await db.execute<{ total: number; ok: number }>(sql`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('confirmed', 'completed', 'no_show'))::int AS ok
    FROM bookings WHERE escort_id = ${profileId} AND created_at >= ${r.from.toISOString()}::timestamptz AND created_at < ${r.to.toISOString()}::timestamptz`);
  const row = res.rows[0];
  return { total: Number(row?.total ?? 0), confirmed: Number(row?.ok ?? 0) };
}

async function ratings(profileId: string, r: Range, unit: Unit, tz: string) {
  const res = await db.execute<{ k: string; avg: number; n: number }>(sql`
    SELECT ${bucket(sql`created_at`, unit, tz)} AS k, avg(rating)::float AS avg, count(*)::int AS n FROM reviews
    WHERE target_id = ${profileId} AND NOT hidden AND created_at >= ${r.from.toISOString()}::timestamptz AND created_at < ${r.to.toISOString()}::timestamptz GROUP BY 1`);
  const all = await db.execute<{ avg: number; n: number; before_sum: number; before_n: number }>(sql`
    SELECT coalesce(avg(rating), 0)::float AS avg, count(*)::int AS n,
      coalesce(sum(rating) FILTER (WHERE created_at < ${r.from.toISOString()}::timestamptz), 0)::int AS before_sum,
      count(*) FILTER (WHERE created_at < ${r.from.toISOString()}::timestamptz)::int AS before_n
    FROM reviews WHERE target_id = ${profileId} AND NOT hidden`);
  return { byKey: new Map(res.rows.map((x) => [x.k, { avg: Number(x.avg), n: Number(x.n) }])), overall: all.rows[0] };
}

async function storyStats(profileId: string, r: Range) {
  const res = await db.execute<{ id: string; created_at: string; overlay: string | null; media_id: string; views: number; likes: number; comments: number }>(sql`
    SELECT s.id, s.created_at, s.overlay_text AS overlay, s.media_id,
      (SELECT count(*)::int FROM story_views v WHERE v.story_id = s.id) AS views,
      (SELECT count(*)::int FROM reactions x WHERE x.target_type = 'story' AND x.target_id = s.id) AS likes,
      (SELECT count(*)::int FROM story_comments c WHERE c.story_id = s.id) AS comments
    FROM stories s WHERE s.author_id = ${profileId} AND s.created_at >= ${r.from.toISOString()}::timestamptz AND s.created_at < ${r.to.toISOString()}::timestamptz
    ORDER BY s.created_at DESC LIMIT 20`);
  return res.rows.map((s) => ({ id: s.id, createdAt: new Date(s.created_at).toISOString(), overlay: s.overlay, mediaId: s.media_id, views: Number(s.views), likes: Number(s.likes), comments: Number(s.comments) }));
}

export type StatsData = Awaited<ReturnType<typeof getStats>>;

export async function getStats(profileId: string, p: Period, opts: { bookings: boolean }) {
  const b = bounds(p);
  const cur: Range = { from: b.from, to: b.to };
  const prev: Range = { from: b.prevFrom, to: b.prevTo };
  const keys = bucketKeys(p.fromDate, p.toDate, p.unit);
  const prevKeys = bucketKeys(b.prevFromDate, b.prevToDate, p.unit);

  const [tCur, tPrev, sCur, sPrev, uCur, uPrev, srcCur, srcPrev, cCur, cPrev, regCur, regPrev, favs, fols, favsPrev, folsPrev, rate, ratePrev, rat, stories] = await Promise.all([
    totals(profileId, cur),
    totals(profileId, prev),
    seriesByType(profileId, cur, p.unit, p.tz),
    seriesByType(profileId, prev, p.unit, p.tz),
    uniqueSeries(profileId, cur, p.unit, p.tz),
    uniqueSeries(profileId, prev, p.unit, p.tz),
    breakdown(profileId, cur, "source"),
    breakdown(profileId, prev, "source"),
    breakdown(profileId, cur, "country"),
    breakdown(profileId, prev, "country"),
    regions(profileId, cur),
    regions(profileId, prev),
    growth("favorites", "target_id", profileId, cur, p.unit, p.tz),
    growth("follows", "followee_id", profileId, cur, p.unit, p.tz),
    growth("favorites", "target_id", profileId, prev, p.unit, p.tz),
    growth("follows", "followee_id", profileId, prev, p.unit, p.tz),
    opts.bookings ? bookingRate(profileId, cur) : Promise.resolve({ total: 0, confirmed: 0 }),
    opts.bookings ? bookingRate(profileId, prev) : Promise.resolve({ total: 0, confirmed: 0 }),
    ratings(profileId, cur, p.unit, p.tz),
    storyStats(profileId, cur),
  ]);

  const series = (curMap: Map<string, number> | undefined, prevMap: Map<string, number> | undefined): SeriesPoint[] =>
    keys.map((key, i) => ({ key, label: bucketLabel(key, p.unit), value: curMap?.get(key) ?? 0, prev: prevMap?.get(prevKeys[i] ?? "") ?? 0 }));

  const cumulative = (g: { base: number; byKey: Map<string, number> }, gp: { base: number; byKey: Map<string, number> }): SeriesPoint[] => {
    let a = g.base;
    let bp = gp.base;
    return keys.map((key, i) => {
      a += g.byKey.get(key) ?? 0;
      bp += gp.byKey.get(prevKeys[i] ?? "") ?? 0;
      return { key, label: bucketLabel(key, p.unit), value: a, prev: bp };
    });
  };

  // Bewertungsverlauf: kumulierter Durchschnitt am Ende jedes Abschnitts
  let sum = Number(rat.overall?.before_sum ?? 0);
  let n = Number(rat.overall?.before_n ?? 0);
  const ratingHistory = keys.map((key) => {
    const x = rat.byKey.get(key);
    if (x) {
      sum += x.avg * x.n;
      n += x.n;
    }
    return { key, label: bucketLabel(key, p.unit), avg: n ? Math.round((sum / n) * 100) / 100 : null, count: x?.n ?? 0 };
  });

  const ctr = (t: Record<EventType, number>) => (t.search_impression ? (t.search_click / t.search_impression) * 100 : 0);
  return {
    period: { ...p, prevFromDate: b.prevFromDate, prevToDate: b.prevToDate },
    totals: { cur: { ...tCur, unique_views: uCur.total, ctr: ctr(tCur) }, prev: { ...tPrev, unique_views: uPrev.total, ctr: ctr(tPrev) } },
    views: series(sCur.get("profile_view"), sPrev.get("profile_view")),
    uniques: series(uCur.byKey, uPrev.byKey),
    impressions: series(sCur.get("search_impression"), sPrev.get("search_impression")),
    clicks: series(sCur.get("search_click"), sPrev.get("search_click")),
    chats: series(sCur.get("chat_start"), sPrev.get("chat_start")),
    bookingRequests: series(sCur.get("booking_request"), sPrev.get("booking_request")),
    storyViews: series(sCur.get("story_view"), sPrev.get("story_view")),
    favorites: cumulative(favs, favsPrev),
    followers: cumulative(fols, folsPrev),
    sources: merge(srcCur, srcPrev),
    countries: merge(cCur, cPrev),
    regions: merge(regCur, regPrev),
    bookings: { cur: rate, prev: ratePrev },
    rating: { avg: Number(rat.overall?.avg ?? 0), count: Number(rat.overall?.n ?? 0), history: ratingHistory },
    stories,
  };
}
