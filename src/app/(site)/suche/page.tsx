import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { FilterSheetButton, FilterSidebar } from "@/components/search/filter-panel";
import { Pagination } from "@/components/search/pagination";
import { ResultsMapLoader } from "@/components/search/results-map-loader";
import { ResultsToolbar } from "@/components/search/results-toolbar";
import { SaveSearchButton } from "@/components/search/save-search-dialog";
import { ProfileCard } from "@/components/shared/profile-card";
import { getSessionUser } from "@/lib/auth/session";
import { suggestName } from "@/lib/search/describe";
import { activeFilterCount, PAGE_SIZE, parseFilters, resetFilters, searchHref, type SearchFilters } from "@/lib/search/filters";
import { loadClubFilterFields, loadSearch, recordImpressions } from "@/lib/search/page-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Suche", description: "Escorts, Clubs und Studios in deiner Nähe finden." };

function TypeTabs({ f }: { f: SearchFilters }) {
  const loc = new URLSearchParams();
  if (f.stadt) loc.set("stadt", f.stadt);
  else if (f.lat != null && f.lng != null) {
    loc.set("lat", f.lat.toFixed(2));
    loc.set("lng", f.lng.toFixed(2));
  }
  if (f.radius !== 25) loc.set("radius", String(f.radius));
  const clubLoc = new URLSearchParams(loc);
  clubLoc.set("typ", "club");
  const tabs = [
    { href: `/suche${loc.size ? `?${loc}` : ""}`, label: "Escorts", active: f.typ === "escort" },
    { href: `/suche?${clubLoc}`, label: "Clubs & Studios", active: f.typ === "club" },
  ];
  return (
    <nav aria-label="Suchtyp" className="flex gap-2">
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center rounded-full border px-4 text-sm font-medium transition-colors",
            t.active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function SearchPage(props: PageProps<"/suche">) {
  const sp = await props.searchParams;
  const f = parseFilters(sp);
  const viewer = await getSessionUser();
  const [{ cards, total, points, origin }, clubFields] = await Promise.all([
    loadSearch(f, viewer),
    f.typ === "club" ? loadClubFilterFields(f.clubtyp) : Promise.resolve([]),
  ]);
  await recordImpressions(
    cards.map((c) => c.id),
    viewer?.id ?? null,
  );

  const noun = f.typ === "club" ? (total === 1 ? "Betrieb" : "Betriebe") : total === 1 ? "Escort" : "Escorts";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const place = f.stadt ? ` in ${f.stadt}` : f.lat != null ? " in deiner Nähe" : "";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">{f.typ === "club" ? `Clubs & Studios${place}` : `Escorts${place}`}</h1>
          <p className="text-sm text-muted-foreground">
            {total} {noun} gefunden
            {origin ? ` im Umkreis von ${f.radius} km` : ""}
          </p>
        </div>
        <TypeTabs f={f} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
        <aside className="hidden lg:block">
          <FilterSidebar filters={f} clubFields={clubFields} />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="lg:hidden">
              <FilterSheetButton filters={f} clubFields={clubFields} total={total} />
            </div>
            <SaveSearchButton filters={f} suggestedName={suggestName(f)} loggedIn={Boolean(viewer)} />
            <div className="ml-auto">
              <ResultsToolbar filters={f} hasOrigin={Boolean(origin)} />
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-16 text-center">
              <SearchX className="size-10 text-muted-foreground" />
              <h2 className="text-lg font-bold">Keine Treffer</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {origin ? "Vergrössere den Umkreis oder entferne einzelne Filter." : "Entferne einzelne Filter oder wähle einen anderen Ort."}
              </p>
              {activeFilterCount(f) > 0 && (
                <Link href={searchHref(resetFilters(f))} className="text-sm font-semibold text-primary hover:underline">
                  Filter zurücksetzen
                </Link>
              )}
            </div>
          ) : f.ansicht === "karte" ? (
            <ResultsMapLoader points={points} origin={origin} radiusKm={f.radius} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {cards.map((c) => (
                  <ProfileCard key={c.id} p={c} showFavorite={Boolean(viewer)} />
                ))}
              </div>
              <Pagination page={f.seite} totalPages={totalPages} hrefFor={(p) => searchHref({ ...f, seite: p }, { keepPage: true })} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
