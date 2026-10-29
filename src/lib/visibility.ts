import "server-only";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { blocks, visibilityBlocks, users } from "@/db/schema";
import { requestCountry } from "@/lib/request";
import type { SessionUser } from "@/lib/auth/session";

/** Länder des Betrachters: Geo-IP und – falls eingeloggt – das Profil-Land. */
export async function viewerCountries(viewer: SessionUser | null) {
  const set = new Set<string>();
  const ip = await requestCountry();
  if (ip) set.add(ip);
  if (viewer?.country) set.add(viewer.country);
  return [...set];
}

type Target = Pick<typeof users.$inferSelect, "id" | "status" | "profileHidden" | "accountType" | "kycStatus">;

/**
 * Darf der Betrachter dieses Profil sehen? Gesperrte Länder, ausgeblendete Profile, Blockierungen
 * und (bei Escorts/Clubs) fehlendes KYC führen zu "nicht gefunden".
 */
export async function canViewProfile(viewer: SessionUser | null, target: Target) {
  const self = viewer?.id === target.id;
  const staff = viewer?.role === "admin" || viewer?.role === "moderator";
  if (self || staff) return true;
  if (target.status !== "active" || target.profileHidden) return false;
  if (target.accountType !== "member" && target.kycStatus !== "verified") return false;
  if (viewer) {
    const b = await db
      .select({ x: blocks.blockerId })
      .from(blocks)
      .where(or(and(eq(blocks.blockerId, viewer.id), eq(blocks.blockedId, target.id)), and(eq(blocks.blockerId, target.id), eq(blocks.blockedId, viewer.id))))
      .limit(1);
    if (b.length) return false;
  }
  const countries = await viewerCountries(viewer);
  if (countries.length) {
    const hit = await db
      .select({ c: visibilityBlocks.countryCode })
      .from(visibilityBlocks)
      .where(and(eq(visibilityBlocks.userId, target.id), inArray(visibilityBlocks.countryCode, countries)))
      .limit(1);
    if (hit.length) return false;
  }
  return true;
}

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

/** Sind zwei User gegenseitig blockiert (in eine Richtung reicht)? */
export async function isBlockedBetween(a: string, b: string) {
  const rows = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))))
    .limit(1);
  return rows.length > 0;
}
