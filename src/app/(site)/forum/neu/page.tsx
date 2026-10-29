import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentViewerProvider } from "@/components/content/viewer-context";
import { ForumShell, type Crumb } from "@/components/forum/forum-shell";
import { NewThreadForm } from "@/components/forum/new-thread-form";
import { requirePageUser } from "@/lib/auth/guards";
import { contentViewer } from "@/lib/content/viewer";
import { canWriteCategory } from "@/lib/forum/access";
import { forumBase } from "@/lib/forum/page-data";

export const metadata: Metadata = { title: "Neues Thema" };

export default async function NewThreadPage(props: PageProps<"/forum/neu">) {
  const sp = await props.searchParams;
  const slug = typeof sp.kategorie === "string" ? sp.kategorie : null;
  const user = await requirePageUser({ next: `/forum/neu${slug ? `?kategorie=${slug}` : ""}` });
  const { cats, tree } = await forumBase(user);
  const viewer = await contentViewer(user);
  const target = slug ? cats.find((c) => c.slug === slug) : null;

  let crumbs: Crumb[] = [{ label: "Forum", href: "/forum" }, { label: "Neues Thema" }];
  let groupMode = false;
  if (target?.groupId) {
    if (!(await canWriteCategory(user, target))) notFound();
    const [g] = await db.select({ name: groups.name, slug: groups.slug }).from(groups).where(eq(groups.id, target.groupId));
    crumbs = [{ label: "Gruppen", href: "/gruppen" }, { label: g?.name ?? "Gruppe", href: `/gruppen/${g?.slug}` }, { label: "Forum", href: `/gruppen/${g?.slug}/forum` }, { label: "Neues Thema" }];
    groupMode = true;
  }

  // Nur Unterforen bzw. Kategorien ohne Unterforen, in denen der Benutzer schreiben darf.
  const leaves = cats.filter((c) => !c.groupId && !cats.some((x) => x.parentId === c.id));
  const options = [];
  for (const c of leaves) {
    const parent = c.parentId ? (cats.find((p) => p.id === c.parentId) ?? null) : null;
    if (await canWriteCategory(user, c, parent)) options.push({ value: c.id, label: c.name, group: parent?.name ?? "Weitere" });
  }

  return (
    <ContentViewerProvider viewer={viewer}>
      <ForumShell tree={tree} active={target && !target.groupId ? target.slug : null} crumbs={crumbs}>
        <h1 className="text-2xl font-extrabold">Neues Thema{target ? ` in ${target.name.replace(/^Forum: /, "")}` : ""}</h1>
        {!user.profileComplete ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">Bitte stelle zuerst dein Profil fertig, um Themen zu erstellen.</p>
            <Button asChild>
              <Link href="/dashboard/profil">Profil fertigstellen</Link>
            </Button>
          </div>
        ) : (
          <NewThreadForm categories={options} initialCategory={target && (groupMode || options.some((o) => o.value === target.id)) ? target.id : null} groupMode={groupMode} />
        )}
      </ForumShell>
    </ContentViewerProvider>
  );
}
