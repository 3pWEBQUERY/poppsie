import type { Metadata } from "next";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, escortProfiles, favoriteFolders, favorites } from "@/db/schema";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { FavoritesManager, type FavoriteItem } from "@/components/profile/favorites-manager";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { ageFrom } from "@/lib/profile/fields";
import { getSummaries } from "@/lib/users/summary";
import { viewerCountries, visibleToSql } from "@/lib/visibility";

export const metadata: Metadata = { title: "Favoriten" };

export default async function FavoritesPage() {
  const { user, locked } = await dashboardPage({ next: "/dashboard/favoriten" });
  if (locked) return <LockedNotice title="Favoriten" />;

  const countries = await viewerCountries(user);
  const rows = await db
    .select({
      targetId: favorites.targetId,
      folderId: favorites.folderId,
      note: favorites.note,
      notify: favorites.notify,
      createdAt: favorites.createdAt,
      escortCity: escortProfiles.city,
      birthDate: escortProfiles.birthDate,
      clubCity: clubProfiles.city,
    })
    .from(favorites)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, favorites.targetId))
    .leftJoin(clubProfiles, eq(clubProfiles.userId, favorites.targetId))
    .where(sql`${favorites.userId} = ${user.id} AND ${visibleToSql(favorites.targetId, user.id, countries)}`)
    .orderBy(desc(favorites.createdAt));
  const folders = await db.select({ id: favoriteFolders.id, name: favoriteFolders.name }).from(favoriteFolders).where(eq(favoriteFolders.userId, user.id)).orderBy(asc(favoriteFolders.createdAt));
  const summaries = await getSummaries(
    rows.map((r) => r.targetId),
    user,
  );

  const items: FavoriteItem[] = rows.flatMap((r) => {
    const s = summaries.get(r.targetId);
    if (!s) return [];
    return [
      {
        id: r.targetId,
        name: s.name,
        href: s.href,
        accountType: s.accountType,
        avatarUrl: s.avatarUrl,
        verified: s.verified,
        online: Boolean(s.online),
        city: r.escortCity ?? r.clubCity ?? null,
        age: ageFrom(r.birthDate),
        folderId: r.folderId,
        note: r.note,
        notify: r.notify,
        addedAt: r.createdAt.toISOString(),
      },
    ];
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Favoriten</h1>
        <p className="mt-1 text-sm text-muted-foreground">Deine gemerkten Profile – sortiert in eigene Ordner, mit privaten Notizen.</p>
      </div>
      <FavoritesManager initialItems={items} initialFolders={folders} />
    </div>
  );
}
