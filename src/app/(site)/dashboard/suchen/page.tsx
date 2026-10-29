import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Bookmark } from "lucide-react";
import { db } from "@/db";
import { savedSearches } from "@/db/schema";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { SavedSearchList, type SavedSearchItem } from "@/components/search/saved-search-list";
import { Button } from "@/components/ui/button";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { countClubs } from "@/lib/search/clubs";
import { describeFilters } from "@/lib/search/describe";
import { countEscorts } from "@/lib/search/escorts";
import { originOf, parseFilters, searchHref } from "@/lib/search/filters";
import { viewerContext } from "@/lib/search/page-data";

export const metadata: Metadata = { title: "Gespeicherte Suchen" };

const dateFmt = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });

export default async function SavedSearchesPage() {
  const { user, locked } = await dashboardPage({ next: "/dashboard/suchen" });
  if (locked) return <LockedNotice title="Gespeicherte Suchen" />;

  const rows = await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)).orderBy(desc(savedSearches.createdAt));
  const base = await viewerContext(user, null);
  const items: SavedSearchItem[] = await Promise.all(
    rows.map(async (r) => {
      const f = parseFilters(new URLSearchParams(r.query as Record<string, string>));
      const ctx = { ...base, origin: originOf(f) };
      const matches = f.typ === "escort" ? await countEscorts(f, ctx) : await countClubs(f, ctx);
      return {
        id: r.id,
        name: r.name,
        href: searchHref(f),
        chips: describeFilters(f),
        kind: f.typ,
        notify: r.notify,
        createdAt: dateFmt.format(r.createdAt),
        matches,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Gespeicherte Suchen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Wir prüfen stündlich, ob neue Profile zu deinen Suchen passen, und benachrichtigen dich.</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/suche">Neue Suche</Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-16 text-center">
          <Bookmark className="size-10 text-muted-foreground" />
          <h2 className="text-lg font-bold">Noch keine gespeicherten Suchen</h2>
          <p className="max-w-sm text-sm text-muted-foreground">Stelle in der Suche deine Filter ein und tippe auf „Suche speichern“. Neue Treffer melden wir dir automatisch.</p>
          <Button asChild>
            <Link href="/suche">Zur Suche</Link>
          </Button>
        </div>
      ) : (
        <SavedSearchList items={items} />
      )}
    </div>
  );
}
