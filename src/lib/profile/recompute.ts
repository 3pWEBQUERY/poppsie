import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, clubTypeSchemas, escortProfiles, media, profileLanguages, users } from "@/db/schema";
import { profileChecks, summarize } from "./completeness";

/** Berechnet profile_complete und profile_score neu und speichert sie. */
export async function recomputeProfile(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const [escort] = user.accountType === "escort" ? await db.select().from(escortProfiles).where(eq(escortProfiles.userId, userId)) : [];
  const [club] = user.accountType === "club" ? await db.select().from(clubProfiles).where(eq(clubProfiles.userId, userId)) : [];
  const [{ n: languages }] = await db.select({ n: count() }).from(profileLanguages).where(eq(profileLanguages.userId, userId));
  const [{ n: galleryCount }] = await db
    .select({ n: count() })
    .from(media)
    .where(and(eq(media.ownerId, userId), eq(media.purpose, "gallery")));
  let requiredClubKeys: string[] = [];
  if (club) {
    const [schema] = await db.select().from(clubTypeSchemas).where(eq(clubTypeSchemas.clubType, club.clubType));
    requiredClubKeys = schema?.fields.filter((f) => f.rule === "required").map((f) => f.key) ?? [];
  }
  const checks = profileChecks(user, { escort, club, languages, galleryCount, requiredClubKeys });
  const s = summarize(checks);
  if (user.profileComplete !== s.complete || user.profileScore !== s.percent) {
    await db.update(users).set({ profileComplete: s.complete, profileScore: s.percent, updatedAt: new Date() }).where(eq(users.id, userId));
  }
  return { ...s, checks };
}
