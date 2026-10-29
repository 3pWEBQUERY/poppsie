/**
 * Query-Builder der Escort-Suche. Rein serverseitig, ohne next/headers (auch im Worker nutzbar):
 * bekommt typisierte Filter + Betrachter-Kontext und liefert Treffer mit Distanz.
 */
import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { escortProfiles, media, users } from "@/db/schema";
import type { EscortFilters, Sort } from "./filters";
import { activeStorySql, distanceSql, favoriteCountSql, newSinceSql, textArray, visibleSql, withinRadiusSql, type ViewerContext } from "./sql";
import { zurichNow } from "./time";

export type EscortRow = {
  id: string;
  username: string;
  displayName: string | null;
  birthDate: string | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  nationality: string | null;
  cupSize: string | null;
  breastType: string | null;
  intimate: string | null;
  piercings: string[];
  tattoos: string | null;
  clothingStyles: string[];
  clothingSize: string | null;
  shoeSize: number | null;
  hairColor: string | null;
  eyeColor: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  services: string[];
  workplace: string | null;
  languages: string[];
  hourlyPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  avatarMediaId: string | null;
  blurForGuests: boolean;
  distanceKm: number | null;
  hasStory: boolean;
  availableToday: boolean;
  favoriteCount: number;
};

export type SearchOptions = {
  limit?: number;
  offset?: number;
  /** Nur Profile, die seit diesem Zeitpunkt neu sind (gespeicherte Suchen). */
  newSince?: Date;
  /** Sortierung überschreiben (z. B. Matches). */
  sort?: Sort;
  /** Distanz berechnen, aber nicht nach Umkreis filtern (Region als "Wäre schön"). */
  noRadius?: boolean;
};

const e = escortProfiles;
const avatar = alias(media, "search_avatar");

const inList = (col: AnyPgColumn, values: string[]) => sql`${col}::text = ANY(${textArray(values)})`;

/** Preis für 1 Stunde, sonst der günstigste Preis. */
export const hourlyPriceSql = sql<number | null>`COALESCE(
  (SELECT (pi->>'price')::int FROM jsonb_array_elements(${e.prices}) pi WHERE (pi->>'minutes')::int = 60 LIMIT 1),
  (SELECT min((pi->>'price')::int) FROM jsonb_array_elements(${e.prices}) pi)
)`;

/** Heute verfügbar: Regel für den heutigen Wochentag (ohne ganztägige Abwesenheit) oder Story mit Sticker. */
export function availableTodaySql(userCol: AnyPgColumn = e.userId): SQL<boolean> {
  const z = zurichNow();
  return sql<boolean>`(
    (EXISTS (SELECT 1 FROM availability_rules ar WHERE ar.user_id = ${userCol} AND ar.weekday = ${z.weekday})
      AND NOT EXISTS (SELECT 1 FROM availability_exceptions ae WHERE ae.user_id = ${userCol} AND ae.kind = 'unavailable'
        AND ${z.date}::date BETWEEN ae.date_from AND ae.date_to AND ae.start_min IS NULL))
    OR EXISTS (SELECT 1 FROM stories sa WHERE sa.author_id = ${userCol} AND sa.expires_at > now()
      AND sa.stickers @> '[{"type":"available_today"}]'::jsonb)
  )`;
}

/** Alle WHERE-Bedingungen der Escort-Suche. */
export function escortConditions(f: EscortFilters, ctx: ViewerContext, opts: SearchOptions = {}): SQL[] {
  const c: SQL[] = [eq(users.accountType, "escort"), visibleSql(e.userId, ctx.viewerId, ctx.countries)];
  if (ctx.origin && !opts.noRadius) c.push(withinRadiusSql(e.lat, e.lng, ctx.origin, f.radius));
  if (f.alter) {
    c.push(sql`${e.birthDate} <= (current_date - make_interval(years => ${f.alter[0]}))`);
    c.push(sql`${e.birthDate} > (current_date - make_interval(years => ${f.alter[1] + 1}))`);
  }
  if (f.groesse) c.push(gte(e.heightCm, f.groesse[0]), lte(e.heightCm, f.groesse[1]));
  if (f.gewicht) c.push(gte(e.weightKg, f.gewicht[0]), lte(e.weightKg, f.gewicht[1]));
  if (f.preis) c.push(sql`${hourlyPriceSql} BETWEEN ${f.preis[0]} AND ${f.preis[1]}`);
  const single: [keyof EscortFilters, AnyPgColumn][] = [
    ["geschlecht", e.gender],
    ["nat", e.nationality],
    ["cup", e.cupSize],
    ["brust", e.breastType],
    ["intim", e.intimate],
    ["tattoos", e.tattoos],
    ["kleidung", e.clothingSize],
    ["schuhe", e.shoeSize],
    ["haare", e.hairColor],
    ["augen", e.eyeColor],
  ];
  for (const [key, col] of single) {
    const v = f[key] as string[];
    if (v.length) c.push(inList(col, v));
  }
  if (f.piercings.length) c.push(sql`${e.piercings} && ${textArray(f.piercings)}`);
  if (f.stil.length) c.push(sql`${e.clothingStyles} && ${textArray(f.stil)}`);
  if (f.services.length) c.push(sql`${e.services} @> ${textArray(f.services)}`);
  if (f.sprachen.length) {
    c.push(sql`EXISTS (SELECT 1 FROM profile_languages pl WHERE pl.user_id = ${e.userId} AND pl.language_code = ANY(${textArray(f.sprachen)}))`);
  }
  if (f.ort) c.push(sql`${e.workplace}::text IN (${f.ort}, 'both')`);
  if (f.bewertung) c.push(sql`${e.ratingAvg} >= ${f.bewertung}`);
  if (f.heute) c.push(availableTodaySql());
  if (f.neu) c.push(sql`${users.createdAt} > now() - interval '14 days'`);
  if (f.verifiziert) {
    c.push(sql`EXISTS (SELECT 1 FROM kyc_verifications kp WHERE kp.user_id = ${e.userId} AND kp.kind = 'photo' AND kp.status = 'verified')`);
  }
  if (f.story) c.push(activeStorySql(e.userId));
  if (opts.newSince) c.push(newSinceSql(e.userId, users.createdAt, opts.newSince));
  return c;
}

function orderFor(sort: Sort, distance: SQL<number> | null, favCount: SQL<number>): SQL[] {
  switch (sort) {
    case "distanz":
      return distance ? [sql`${distance} ASC NULLS LAST`, desc(e.ratingAvg)] : [desc(users.createdAt)];
    case "bewertung":
      return [desc(e.ratingAvg), desc(e.ratingCount)];
    case "neu":
      return [desc(users.createdAt)];
    case "beliebt":
      return [sql`${favCount} DESC`, desc(e.ratingAvg)];
  }
}

export async function searchEscorts(f: EscortFilters, ctx: ViewerContext, opts: SearchOptions = {}) {
  const distance = ctx.origin ? distanceSql(e.lat, e.lng, ctx.origin) : null;
  const favCount = favoriteCountSql(e.userId);
  const rows = await db
    .select({
      id: e.userId,
      username: users.username,
      displayName: e.displayName,
      birthDate: e.birthDate,
      gender: e.gender,
      heightCm: e.heightCm,
      weightKg: e.weightKg,
      nationality: e.nationality,
      cupSize: e.cupSize,
      breastType: e.breastType,
      intimate: e.intimate,
      piercings: e.piercings,
      tattoos: e.tattoos,
      clothingStyles: e.clothingStyles,
      clothingSize: e.clothingSize,
      shoeSize: e.shoeSize,
      hairColor: e.hairColor,
      eyeColor: e.eyeColor,
      city: e.city,
      lat: e.lat,
      lng: e.lng,
      services: e.services,
      workplace: e.workplace,
      languages: sql<string[]>`ARRAY(SELECT pl.language_code FROM profile_languages pl WHERE pl.user_id = ${e.userId} ORDER BY pl.level DESC)`,
      hourlyPrice: hourlyPriceSql,
      ratingAvg: e.ratingAvg,
      ratingCount: e.ratingCount,
      createdAt: users.createdAt,
      avatarMediaId: users.avatarMediaId,
      avatarBlur: avatar.blurForGuests,
      profileBlur: e.blurForGuests,
      distanceKm: distance ? sql<number>`${distance}` : sql<null>`NULL::float8`,
      hasStory: activeStorySql(e.userId),
      availableToday: availableTodaySql(),
      favoriteCount: favCount,
      total: sql<number>`(count(*) OVER())::int`,
    })
    .from(e)
    .innerJoin(users, eq(users.id, e.userId))
    .leftJoin(avatar, eq(avatar.id, users.avatarMediaId))
    .where(and(...escortConditions(f, ctx, opts)))
    .orderBy(...orderFor(opts.sort ?? f.sort, distance, favCount), asc(e.userId))
    .limit(opts.limit ?? 24)
    .offset(opts.offset ?? 0);

  const items: EscortRow[] = rows.map(({ avatarBlur, profileBlur, total: _t, ...r }) => ({
    ...r,
    ratingAvg: Number(r.ratingAvg),
    distanceKm: r.distanceKm == null ? null : Number(r.distanceKm),
    blurForGuests: Boolean(avatarBlur) || profileBlur,
  }));
  return { items, total: rows[0]?.total ?? 0 };
}

/** Nur zählen (z. B. für Benachrichtigungen gespeicherter Suchen). */
export async function countEscorts(f: EscortFilters, ctx: ViewerContext, opts: SearchOptions = {}) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(e)
    .innerJoin(users, eq(users.id, e.userId))
    .where(and(...escortConditions(f, ctx, opts)));
  return row?.n ?? 0;
}
