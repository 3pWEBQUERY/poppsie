/** Query-Builder der Club-/Studio-Suche (rein, ohne next/headers). */
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clubProfiles, media, users, type OpeningHours } from "@/db/schema";
import type { SearchOptions } from "./escorts";
import type { ClubFilters, Sort } from "./filters";
import { activeStorySql, distanceSql, favoriteCountSql, newSinceSql, textArray, visibleSql, withinRadiusSql, type ViewerContext } from "./sql";
import { zurichNow } from "./time";

export type ClubRow = {
  id: string;
  username: string;
  slug: string;
  name: string | null;
  clubType: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  data: Record<string, unknown>;
  openingHours: Partial<OpeningHours>;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  imageMediaId: string | null;
  blurForGuests: boolean;
  distanceKm: number | null;
  hasStory: boolean;
  lineupCount: number;
  favoriteCount: number;
};

const c = clubProfiles;
const avatar = alias(media, "club_avatar");
const logo = alias(media, "club_logo");

/** Zahlwert eines JSON-Felds oder NULL, falls kein Zahlwert. */
const jsonNumber = (key: string) => sql`(CASE WHEN jsonb_typeof(${c.data}->${key}::text) = 'number' THEN (${c.data}->>${key}::text)::numeric END)`;

/** Jetzt geöffnet (Europe/Zurich); Zeitfenster über Mitternacht zählen auch am Folgetag. */
export function openNowSql(): SQL {
  const z = zurichNow();
  return sql`(
    EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${c.openingHours}->${z.dayKey}::text, '[]'::jsonb)) oh
      WHERE (oh->>'from') <= ${z.time} AND ((oh->>'to') > ${z.time} OR (oh->>'to') <= (oh->>'from')))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${c.openingHours}->${z.prevDayKey}::text, '[]'::jsonb)) oh
      WHERE (oh->>'to') <= (oh->>'from') AND ${z.time} < (oh->>'to'))
  )`;
}

export function clubConditions(f: ClubFilters, ctx: ViewerContext, opts: SearchOptions = {}): SQL[] {
  const w: SQL[] = [eq(users.accountType, "club"), visibleSql(c.userId, ctx.viewerId, ctx.countries)];
  if (ctx.origin && !opts.noRadius) w.push(withinRadiusSql(c.lat, c.lng, ctx.origin, f.radius));
  if (f.clubtyp.length) w.push(sql`${c.clubType}::text = ANY(${textArray(f.clubtyp)})`);
  if (f.offen) w.push(openNowSql());
  if (f.eintritt != null) w.push(sql`(${jsonNumber("entryPrice")} IS NULL OR ${jsonNumber("entryPrice")} <= ${f.eintritt})`);
  if (f.wellness.length) w.push(sql`${c.data}->'wellness' @> ${JSON.stringify(f.wellness)}::jsonb`);
  for (const key of f.extra.bool) w.push(sql`${c.data}->${key}::text = 'true'::jsonb`);
  for (const [key, vals] of Object.entries(f.extra.multi)) w.push(sql`${c.data}->${key}::text @> ${JSON.stringify(vals)}::jsonb`);
  for (const [key, min] of Object.entries(f.extra.min)) w.push(sql`${jsonNumber(key)} >= ${min}`);
  if (opts.newSince) w.push(newSinceSql(c.userId, users.createdAt, opts.newSince));
  return w;
}

function orderFor(sort: Sort, distance: SQL<number> | null, favCount: SQL<number>): SQL[] {
  switch (sort) {
    case "distanz":
      return distance ? [sql`${distance} ASC NULLS LAST`, desc(c.ratingAvg)] : [desc(users.createdAt)];
    case "bewertung":
      return [desc(c.ratingAvg), desc(c.ratingCount)];
    case "neu":
      return [desc(users.createdAt)];
    case "beliebt":
      return [sql`${favCount} DESC`, desc(c.ratingAvg)];
  }
}

const lineupSql = sql<number>`(SELECT count(*) FROM club_links cl WHERE cl.club_id = ${c.userId} AND cl.status = 'accepted')::int`;

export async function searchClubs(f: ClubFilters, ctx: ViewerContext, opts: SearchOptions & { ids?: string[] } = {}) {
  const distance = ctx.origin ? distanceSql(c.lat, c.lng, ctx.origin) : null;
  const favCount = favoriteCountSql(c.userId);
  const where = clubConditions(f, ctx, opts);
  if (opts.ids) where.push(opts.ids.length ? sql`${c.userId}::text = ANY(${textArray(opts.ids)})` : sql`false`);
  const rows = await db
    .select({
      id: c.userId,
      username: users.username,
      slug: c.slug,
      name: c.name,
      clubType: c.clubType,
      city: c.city,
      lat: c.lat,
      lng: c.lng,
      data: c.data,
      openingHours: c.openingHours,
      ratingAvg: c.ratingAvg,
      ratingCount: c.ratingCount,
      createdAt: users.createdAt,
      logoMediaId: c.logoMediaId,
      logoBlur: logo.blurForGuests,
      avatarMediaId: users.avatarMediaId,
      avatarBlur: avatar.blurForGuests,
      profileBlur: c.blurForGuests,
      distanceKm: distance ? sql<number>`${distance}` : sql<null>`NULL::float8`,
      hasStory: activeStorySql(c.userId),
      lineupCount: lineupSql,
      favoriteCount: favCount,
      total: sql<number>`(count(*) OVER())::int`,
    })
    .from(c)
    .innerJoin(users, eq(users.id, c.userId))
    .leftJoin(avatar, eq(avatar.id, users.avatarMediaId))
    .leftJoin(logo, eq(logo.id, c.logoMediaId))
    .where(and(...where))
    .orderBy(...orderFor(opts.sort ?? f.sort, distance, favCount), asc(c.userId))
    .limit(opts.limit ?? 24)
    .offset(opts.offset ?? 0);

  const items: ClubRow[] = rows.map(({ logoMediaId, logoBlur, avatarMediaId, avatarBlur, profileBlur, total: _t, ...r }) => ({
    ...r,
    ratingAvg: Number(r.ratingAvg),
    distanceKm: r.distanceKm == null ? null : Number(r.distanceKm),
    imageMediaId: avatarMediaId ?? logoMediaId,
    blurForGuests: profileBlur || Boolean(avatarMediaId ? avatarBlur : logoBlur),
  }));
  return { items, total: rows[0]?.total ?? 0 };
}

export async function countClubs(f: ClubFilters, ctx: ViewerContext, opts: SearchOptions = {}) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(c)
    .innerJoin(users, eq(users.id, c.userId))
    .where(and(...clubConditions(f, ctx, opts)));
  return row?.n ?? 0;
}
