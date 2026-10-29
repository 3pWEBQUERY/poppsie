/**
 * SQL-Bausteine für Umkreissuche und Sichtbarkeit (ohne PostGIS).
 * Bewusst ohne "server-only"/next/headers, damit der Job-Worker sie nutzen kann.
 */
import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export type Origin = { lat: number; lng: number };

/** Kontext des Betrachters (Länder aus Geo-IP/Profil, Ausgangspunkt für Distanzen). */
export type ViewerContext = { viewerId: string | null; countries: string[]; origin: Origin | null };

/** Haversine-Distanz in km als SQL-Ausdruck. */
export function distanceSql(latCol: AnyPgColumn, lngCol: AnyPgColumn, o: Origin): SQL<number> {
  return sql<number>`(6371 * 2 * asin(sqrt(
    power(sin(radians(${latCol} - ${o.lat}) / 2), 2) +
    cos(radians(${o.lat})) * cos(radians(${latCol})) * power(sin(radians(${lngCol} - ${o.lng}) / 2), 2)
  )))`;
}

/** Bounding-Box als Vorfilter (indexierbar über lat/lng), danach exakte Distanz. */
export function withinRadiusSql(latCol: AnyPgColumn, lngCol: AnyPgColumn, o: Origin, radiusKm: number): SQL {
  const dLat = radiusKm / 111.045;
  const dLng = radiusKm / (111.045 * Math.max(0.01, Math.cos((o.lat * Math.PI) / 180)));
  return sql`${latCol} BETWEEN ${o.lat - dLat} AND ${o.lat + dLat}
    AND ${lngCol} BETWEEN ${o.lng - dLng} AND ${o.lng + dLng}
    AND ${distanceSql(latCol, lngCol, o)} <= ${radiusKm}`;
}

/**
 * Gleiche Regeln wie visibleToSql aus @/lib/visibility (aktiv, nicht ausgeblendet, KYC bei Anbietern,
 * Länder-Sperren, Blockierungen). Eigene Kopie, weil @/lib/visibility "server-only" importiert
 * und damit im Worker nicht geladen werden kann.
 */
export function visibleSql(userCol: AnyPgColumn, viewerId: string | null, countries: string[]): SQL {
  const parts: SQL[] = [
    sql`EXISTS (SELECT 1 FROM users vu WHERE vu.id = ${userCol} AND vu.status = 'active' AND NOT vu.profile_hidden
      AND (vu.account_type = 'member' OR vu.kyc_status = 'verified'))`,
  ];
  const clean = countries.map((c) => c.toUpperCase().replace(/[^A-Z]/g, "")).filter(Boolean);
  if (clean.length) {
    parts.push(
      sql`NOT EXISTS (SELECT 1 FROM visibility_blocks vb WHERE vb.user_id = ${userCol} AND vb.country_code IN (${sql.join(
        clean.map((c) => sql`${c}`),
        sql`, `,
      )}))`,
    );
  }
  if (viewerId) {
    parts.push(
      sql`NOT EXISTS (SELECT 1 FROM blocks bl WHERE (bl.blocker_id = ${viewerId} AND bl.blocked_id = ${userCol}) OR (bl.blocker_id = ${userCol} AND bl.blocked_id = ${viewerId}))`,
    );
  }
  return sql.join(parts, sql` AND `);
}

/** Text-Array als SQL-Parameter. */
export function textArray(values: string[]): SQL {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;
}

/** Hat die Person eine aktive (nicht abgelaufene) Story? */
export function activeStorySql(userCol: AnyPgColumn): SQL<boolean> {
  return sql<boolean>`EXISTS (SELECT 1 FROM stories st WHERE st.author_id = ${userCol} AND st.expires_at > now())`;
}

/** Anzahl Favoriten (für Sortierung "Beliebt"). */
export function favoriteCountSql(userCol: AnyPgColumn): SQL<number> {
  return sql<number>`(SELECT count(*) FROM favorites fv WHERE fv.target_id = ${userCol})::int`;
}

/** Neu seit einem Zeitpunkt: Konto angelegt oder Identität verifiziert (für gespeicherte Suchen). */
export function newSinceSql(userCol: AnyPgColumn, createdCol: AnyPgColumn, since: Date): SQL {
  const iso = since.toISOString();
  return sql`(${createdCol} > ${iso}::timestamptz OR EXISTS (SELECT 1 FROM kyc_verifications kv WHERE kv.user_id = ${userCol}
    AND kv.kind = 'identity' AND kv.status = 'verified' AND kv.decided_at > ${iso}::timestamptz))`;
}
