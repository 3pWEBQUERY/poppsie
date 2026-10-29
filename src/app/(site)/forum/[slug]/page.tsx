import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Lock, PenSquare } from "lucide-react";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { ForumShell, type Crumb } from "@/components/forum/forum-shell";
import { Pagination, SortLinks, ThreadList } from "@/components/forum/thread-list";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { canReadCategory, canWriteCategory, categoryBySlug } from "@/lib/forum/access";
import { forumBase, parsePage, parseSort, withChildren } from "@/lib/forum/page-data";
import { listThreads, THREADS_PER_PAGE } from "@/lib/forum/queries";
import { viewerCountries } from "@/lib/visibility";

export async function generateMetadata(props: PageProps<"/forum/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const cat = await categoryBySlug(slug);
  return { title: cat ? `${cat.name} – Forum` : "Forum" };
}

const TYPE_LABEL: Record<string, string> = { escort: "Escorts", club: "Clubs", member: "Mitglieder" };

export default async function ForumCategoryPage(props: PageProps<"/forum/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const user = await getSessionUser();
  const cat = await categoryBySlug(slug);
  if (!cat) notFound();
  if (cat.groupId) {
    const [g] = await db.select({ slug: groups.slug }).from(groups).where(eq(groups.id, cat.groupId));
    if (g) redirect(`/gruppen/${g.slug}/forum`);
    notFound();
  }
  const { cats, tree } = await forumBase(user);
  const parent = cat.parentId ? (cats.find((c) => c.id === cat.parentId) ?? null) : null;
  const crumbs: Crumb[] = [{ label: "Forum", href: "/forum" }, ...(parent ? [{ label: parent.name, href: `/forum/${parent.slug}` }] : []), { label: cat.name }];

  if (!(await canReadCategory(user, cat, parent))) {
    return (
      <ForumShell tree={tree} active={cat.slug} crumbs={crumbs}>
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-16 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <h1 className="text-xl font-bold">{cat.name}</h1>
          <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für bestimmte Kontotypen sichtbar.</p>
          {!user && (
            <Button asChild>
              <Link href={`/anmelden?next=/forum/${cat.slug}`}>Anmelden</Link>
            </Button>
          )}
        </div>
      </ForumShell>
    );
  }

  const children = cats.filter((c) => c.parentId === cat.id && !c.groupId);
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.seite);
  const countries = await viewerCountries(user);
  const { items, total } = await listThreads(user, countries, { categoryIds: withChildren(cat, cats), sort, page });
  const canWrite = await canWriteCategory(user, cat, parent);
  const writeTypes = cat.writeTypes.length ? cat.writeTypes : (parent?.writeTypes ?? []);
  const newHref = children.length ? "/forum/neu" : `/forum/neu?kategorie=${cat.slug}`;

  return (
    <ForumShell tree={tree} active={cat.slug} crumbs={crumbs}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{cat.name}</h1>
          {cat.description && <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>}
          {writeTypes.length > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> Neue Beiträge nur für {writeTypes.map((t) => TYPE_LABEL[t] ?? t).join(" und ")}
            </p>
          )}
        </div>
        {user && (canWrite || children.length > 0) ? (
          <Button asChild>
            <Link href={newHref}>
              <PenSquare /> Beitrag schreiben
            </Link>
          </Button>
        ) : !user ? (
          <Button asChild variant="outline">
            <Link href={`/anmelden?next=/forum/${cat.slug}`}>Anmelden zum Schreiben</Link>
          </Button>
        ) : null}
      </div>
      {children.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {children.map((c) => (
            <li key={c.id}>
              <Link href={`/forum/${c.slug}`} className="inline-flex rounded-full border px-3 py-1 text-xs font-medium hover:border-foreground/40 hover:bg-accent">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{total === 1 ? "1 Thema" : `${total} Themen`}</p>
        <SortLinks base={`/forum/${cat.slug}`} sort={sort} />
      </div>
      <ThreadList items={items} empty="In diesem Bereich gibt es noch keine Themen. Starte das erste!" />
      <Pagination page={page} pages={Math.ceil(total / THREADS_PER_PAGE)} href={(p) => `/forum/${cat.slug}?${new URLSearchParams({ ...(sort !== "aktivitaet" ? { sort } : {}), seite: String(p) })}`} />
    </ForumShell>
  );
}
