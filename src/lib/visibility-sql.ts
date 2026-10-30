import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * SQL-Bedingung für Listen (Suche, Feed, Stories, Matches): blendet Profile aus, die der Betrachter
 * nicht sehen darf. userCol ist die Spalte mit der User-ID des Profils.
 */
export function visibleToSql(userCol: AnyPgColumn, viewerId: string | null, countries: string[], opts: { requireKyc?: boolean } = {}): SQL {
  const parts: SQL[] = [
    sql`EXISTS (SELECT 1 FROM users vu WHERE vu.id = ${userCol} AND vu.status = 'active' AND NOT vu.profile_hidden
      ${opts.requireKyc === false ? sql`` : sql`AND (vu.account_type = 'member' OR vu.kyc_status = 'verified')`})`,
  ];
  const clean = countries.map((c) => c.replace(/[^A-Z]/g, "")).filter(Boolean);
  if (clean.length) {
    parts.push(sql`NOT EXISTS (SELECT 1 FROM visibility_blocks vb WHERE vb.user_id = ${userCol} AND vb.country_code IN (${sql.join(clean.map((c) => sql`${c}`), sql`, `)}))`);
  }
  if (viewerId) {
    parts.push(sql`NOT EXISTS (SELECT 1 FROM blocks bl WHERE (bl.blocker_id = ${viewerId} AND bl.blocked_id = ${userCol}) OR (bl.blocker_id = ${userCol} AND bl.blocked_id = ${viewerId}))`);
  }
  return sql.join(parts, sql` AND `);
}
