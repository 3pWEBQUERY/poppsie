import type { Metadata } from "next";
import { asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { forumCategories, forumCategoryModerators, forumThreads, users } from "@/db/schema";
import { PageTitle } from "@/components/admin/badges";
import { ForumAdmin, type ForumCategoryRow } from "@/components/admin/forum-admin";
import { requireStaffPage } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Forum" };

type AccountType = "member" | "escort" | "club";
const asTypes = (t: string[]) => t.filter((x): x is AccountType => x === "member" || x === "escort" || x === "club");

export default async function ForumAdminPage() {
  await requireStaffPage();
  // Nur das globale Forum; Gruppen-Foren verwalten die Gruppen selbst.
  const cats = await db.select().from(forumCategories).where(isNull(forumCategories.groupId)).orderBy(asc(forumCategories.sortOrder), asc(forumCategories.name));
  const ids = cats.map((c) => c.id);
  const [mods, threads] = ids.length
    ? await Promise.all([
        db
          .select({ categoryId: forumCategoryModerators.categoryId, id: users.id, username: users.username })
          .from(forumCategoryModerators)
          .innerJoin(users, eq(users.id, forumCategoryModerators.userId))
          .where(inArray(forumCategoryModerators.categoryId, ids)),
        db.select({ categoryId: forumThreads.categoryId, n: count() }).from(forumThreads).where(inArray(forumThreads.categoryId, ids)).groupBy(forumThreads.categoryId),
      ])
    : [[], []];
  const rows: ForumCategoryRow[] = cats.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    sortOrder: c.sortOrder,
    readTypes: asTypes(c.readTypes),
    writeTypes: asTypes(c.writeTypes),
    adultOnlyMedia: c.adultOnlyMedia,
    threadCount: threads.find((t) => t.categoryId === c.id)?.n ?? 0,
    moderators: mods.filter((m) => m.categoryId === c.id).map((m) => ({ id: m.id, username: m.username })),
  }));
  return (
    <div>
      <PageTitle title="Forum" description="Kategorien und Unterforen, Lese- und Schreibrechte je Kontotyp, Kategorie-Moderatoren." />
      <ForumAdmin categories={rows} />
    </div>
  );
}
