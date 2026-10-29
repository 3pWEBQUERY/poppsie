import Link from "next/link";
import type { Metadata } from "next";
import { PenSquare } from "lucide-react";
import { db } from "@/db";
import { forumCategories } from "@/db/schema";
import { GroupLocked } from "@/components/groups/group-locked";
import { Pagination, SortLinks, ThreadList } from "@/components/forum/thread-list";
import { Button } from "@/components/ui/button";
import { groupCategory } from "@/lib/forum/access";
import { parsePage, parseSort } from "@/lib/forum/page-data";
import { listThreads, THREADS_PER_PAGE } from "@/lib/forum/queries";
import { loadGroupPage } from "@/lib/groups/page-data";
import { viewerCountries } from "@/lib/visibility";

export const metadata: Metadata = { title: "Gruppen-Forum" };

export default async function GroupForumPage(props: PageProps<"/gruppen/[slug]/forum">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { user, group: g, can } = await loadGroupPage(slug);
  if (!can.read) return <GroupLocked />;
  let cat = await groupCategory(g.id);
  if (!cat) {
    // Ältere Gruppen ohne Forum: Kategorie nachträglich anlegen.
    [cat] = await db.insert(forumCategories).values({ slug: `gruppe-${g.slug}`, name: `Forum: ${g.name}`, groupId: g.id }).onConflictDoNothing().returning();
    cat ??= (await groupCategory(g.id))!;
  }
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.seite);
  const { items, total } = await listThreads(user, await viewerCountries(user), { categoryIds: [cat.id], sort, page });
  const base = `/gruppen/${g.slug}/forum`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 text-lg font-bold">Gruppen-Forum</h2>
        <SortLinks base={base} sort={sort} />
        {can.post && (
          <Button asChild>
            <Link href={`/forum/neu?kategorie=${cat.slug}`}>
              <PenSquare /> Neues Thema
            </Link>
          </Button>
        )}
      </div>
      <ThreadList items={items} empty="Noch keine Themen im Gruppen-Forum." />
      <Pagination page={page} pages={Math.ceil(total / THREADS_PER_PAGE)} href={(p) => `${base}?${new URLSearchParams({ ...(sort !== "aktivitaet" ? { sort } : {}), seite: String(p) })}`} />
    </div>
  );
}
