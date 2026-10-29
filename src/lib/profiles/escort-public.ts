import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, escortProfiles, profileLanguages, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { usersWithActiveStory } from "@/lib/stories/active";
import { getSummary } from "@/lib/users/summary";
import { connectState, publicGallery, relationTo, singleMedia } from "./public";

type User = typeof users.$inferSelect;

/** Alles, was die öffentliche Escort-Seite braucht (Sichtbarkeit wurde vorher geprüft). */
export async function loadEscortPage(u: User, viewer: SessionUser | null) {
  const [e] = await db.select().from(escortProfiles).where(eq(escortProfiles.userId, u.id));
  const [langs, gallery, avatarUrl, rel, stories, rules, summary] = await Promise.all([
    db.select().from(profileLanguages).where(eq(profileLanguages.userId, u.id)),
    publicGallery(u.id, viewer),
    singleMedia(u.avatarMediaId, viewer, "t"),
    relationTo(viewer, u.id),
    usersWithActiveStory([u.id]),
    db.select().from(availabilityRules).where(eq(availabilityRules.userId, u.id)),
    getSummary(u.id, viewer),
  ]);
  const connect = e ? await connectState(e, viewer) : { allowed: false, reason: "Kontakt nur über Buchung" };
  return {
    escort: e ?? null,
    languages: langs.sort((a, b) => b.level - a.level),
    gallery,
    avatarUrl,
    relation: rel,
    hasStory: stories.has(u.id),
    rules,
    online: summary?.online ?? false,
    connect,
  };
}
