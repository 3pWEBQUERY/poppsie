import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubLinks, clubProfiles, clubTypeSchemas, escortProfiles, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { ageFrom } from "@/lib/profile/fields";
import { usersWithActiveStory } from "@/lib/stories/active";
import { getSummaries } from "@/lib/users/summary";
import { viewerCountries, visibleToSql } from "@/lib/visibility";
import { zurichToday } from "./hours";
import { publicGallery, relationTo, singleMedia } from "./public";

export async function findClubBySlug(slug: string) {
  const [row] = await db
    .select({ club: clubProfiles, user: users })
    .from(clubProfiles)
    .innerJoin(users, eq(users.id, clubProfiles.userId))
    .where(eq(clubProfiles.slug, slug.toLowerCase()));
  return row ?? null;
}

export type LineupEntry = { id: string; name: string; href: string; avatarUrl: string | null; age: number | null; verified: boolean; presentToday: boolean; hasStory: boolean };

/** Bestätigte Line-up-Girls, die der Betrachter sehen darf; "heute anwesend" zuerst. */
export async function clubLineup(clubId: string, viewer: SessionUser | null): Promise<LineupEntry[]> {
  const countries = await viewerCountries(viewer);
  const rows = await db
    .select({ id: clubLinks.escortId, presentOn: clubLinks.presentOn, birthDate: escortProfiles.birthDate })
    .from(clubLinks)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, clubLinks.escortId))
    .where(and(eq(clubLinks.clubId, clubId), eq(clubLinks.status, "accepted"), sql`${visibleToSql(clubLinks.escortId, viewer?.id ?? null, countries)}`));
  const ids = rows.map((r) => r.id);
  const [summaries, stories] = await Promise.all([getSummaries(ids, viewer), usersWithActiveStory(ids)]);
  const today = zurichToday();
  return rows
    .map((r) => {
      const s = summaries.get(r.id);
      return {
        id: r.id,
        name: s?.name ?? "",
        href: s?.href ?? "#",
        avatarUrl: s?.avatarUrl ?? null,
        age: ageFrom(r.birthDate),
        verified: s?.verified ?? false,
        presentToday: r.presentOn === today,
        hasStory: stories.has(r.id),
      };
    })
    .filter((r) => r.name)
    .sort((a, b) => Number(b.presentToday) - Number(a.presentToday) || a.name.localeCompare(b.name, "de"));
}

export async function loadClubPage(club: typeof clubProfiles.$inferSelect, u: typeof users.$inferSelect, viewer: SessionUser | null) {
  const [schemaRows, gallery, logoUrl, coverUrl, rel, lineup, stories] = await Promise.all([
    db.select().from(clubTypeSchemas).where(eq(clubTypeSchemas.clubType, club.clubType)),
    publicGallery(u.id, viewer),
    singleMedia(club.logoMediaId ?? u.avatarMediaId, viewer, "t"),
    singleMedia(u.coverMediaId, viewer, "o"),
    relationTo(viewer, u.id),
    clubLineup(u.id, viewer),
    usersWithActiveStory([u.id]),
  ]);
  const schema = schemaRows[0];
  return {
    typeLabel: schema?.label ?? club.clubType,
    fields: (schema?.fields ?? []).filter((f) => f.rule !== "hidden"),
    gallery,
    logoUrl,
    coverUrl: coverUrl ?? gallery.find((g) => g.kind === "image")?.full ?? null,
    relation: rel,
    lineup,
    hasStory: stories.has(u.id),
  };
}
