import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { blocks, visibilityBlocks, users } from "@/db/schema";
import { requestCountry } from "@/lib/request";
import type { SessionUser } from "@/lib/auth/session";

export { visibleToSql } from "./visibility-sql";

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

/** Sind zwei User gegenseitig blockiert (in eine Richtung reicht)? */
export async function isBlockedBetween(a: string, b: string) {
  const rows = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))))
    .limit(1);
  return rows.length > 0;
}
