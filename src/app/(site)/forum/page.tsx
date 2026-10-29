import Link from "next/link";
import type { Metadata } from "next";
import { PenSquare } from "lucide-react";
import { RelativeTime } from "@/components/content/relative-time";
import { ForumShell } from "@/components/forum/forum-shell";
import { Pagination, SortLinks, ThreadList } from "@/components/forum/thread-list";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { forumBase, parsePage, parseSort } from "@/lib/forum/page-data";
import { listThreads, THREADS_PER_PAGE } from "@/lib/forum/queries";
import { viewerCountries } from "@/lib/visibility";

export const metadata: Metadata = { title: "Forum" };

export default async function ForumIndex(props: PageProps<"/forum">) {
  const sp = await props.searchParams;
  const user = await getSessionUser();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const tag = typeof sp.tag === "string" ? sp.tag.trim().toLowerCase().slice(0, 30) : "";
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.seite);
  const countries = await viewerCountries(user);
  const { readable, tree } = await forumBase(user);
  const searching = Boolean(q || tag);
  const { items, total } = await listThreads(user, countries, { categoryIds: readable, sort, page, q: q || null, tag: tag || null, perPage: searching ? THREADS_PER_PAGE : 10 });
  const extra: Record<string, string> = {};
  if (q) extra.q = q;
  if (tag) extra.tag = tag;

  return (
    <ForumShell tree={tree} active={null} query={q} crumbs={[{ label: "Forum", href: searching ? "/forum" : undefined }, ...(searching ? [{ label: q ? `Suche: „${q}“` : `#${tag}` }] : [])]}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{searching ? (q ? `Suchergebnisse für „${q}“` : `Themen mit #${tag}`) : "Forum"}</h1>
        {user && (
          <Button asChild className="ml-auto">
            <Link href="/forum/neu">
              <PenSquare /> Beitrag schreiben
            </Link>
          </Button>
        )}
      </div>

      {searching ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{total === 1 ? "1 Thema gefunden" : `${total} Themen gefunden`}</p>
            <SortLinks base="/forum" sort={sort} extra={extra} />
          </div>
          <ThreadList items={items} empty="Keine Themen gefunden. Versuche einen anderen Suchbegriff." />
          <Pagination page={page} pages={Math.ceil(total / THREADS_PER_PAGE)} href={(p) => `/forum?${new URLSearchParams({ ...extra, ...(sort !== "aktivitaet" ? { sort } : {}), seite: String(p) })}`} />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Tausche dich mit der Community aus: nach Region, Themen und Club-Typen. Bitte beachte die Forenregeln.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {tree.map((t) => (
              <section key={t.id} className="flex flex-col gap-2 rounded-lg border border-l-2 border-l-primary bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold">
                    <Link href={`/forum/${t.slug}`} className="hover:text-primary">
                      {t.name}
                    </Link>
                  </h2>
                  <span className="shrink-0 text-xs text-muted-foreground">{t.threadCount} Themen</span>
                </div>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                {t.children.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {t.children.map((c) => (
                      <li key={c.id}>
                        <Link href={`/forum/${c.slug}`} className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-accent">
                          {c.name}
                          {c.threadCount > 0 && <span className="ml-1 text-muted-foreground">{c.threadCount}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {t.lastActivity && (
                  <p className="mt-auto text-[11px] text-muted-foreground">
                    Letzte Aktivität <RelativeTime iso={t.lastActivity} />
                  </p>
                )}
              </section>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <h2 className="text-lg font-bold">Aktuelle Themen</h2>
            <SortLinks base="/forum" sort={sort} />
          </div>
          <ThreadList items={items} />
        </>
      )}
    </ForumShell>
  );
}
