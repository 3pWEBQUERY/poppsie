import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Plus, Search } from "lucide-react";
import { GroupCard } from "@/components/groups/group-card";
import { Pagination } from "@/components/forum/thread-list";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { CANTON_NAMES } from "@/lib/geo/countries";
import { myGroups, regionSuggestions, searchGroups } from "@/lib/groups/queries";

export const metadata: Metadata = { title: "Gruppen" };

export default async function GroupsPage(props: PageProps<"/gruppen">) {
  const sp = await props.searchParams;
  const user = await getSessionUser();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const region = typeof sp.region === "string" && sp.region in CANTON_NAMES ? sp.region : null;
  const page = Math.max(1, Number(typeof sp.seite === "string" ? sp.seite : 1) || 1);
  const [found, mine, suggestions] = await Promise.all([
    searchGroups(user, { q, region, page }),
    user ? myGroups(user) : Promise.resolve([]),
    user && !q && !region ? regionSuggestions(user) : Promise.resolve([]),
  ]);
  const regionName = user?.region ? CANTON_NAMES[user.region as keyof typeof CANTON_NAMES] : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">Gruppen</h1>
          <p className="text-sm text-muted-foreground">Finde Gleichgesinnte nach Region und Interessen – mit eigenem Feed und Forum.</p>
        </div>
        {user && (
          <Button asChild>
            <Link href="/gruppen/neu">
              <Plus /> Gruppe erstellen
            </Link>
          </Button>
        )}
      </div>

      <form action="/gruppen" className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Gruppen suchen …" aria-label="Gruppen suchen" className="h-10 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring" />
        </div>
        {region && <input type="hidden" name="region" value={region} />}
        <Button type="submit" variant="secondary" className="h-10">
          Suchen
        </Button>
      </form>
      {(q || region) && (
        <p className="text-sm text-muted-foreground">
          {found.total} {found.total === 1 ? "Gruppe" : "Gruppen"}
          {region && ` in ${CANTON_NAMES[region as keyof typeof CANTON_NAMES]}`}
          {q && ` für „${q}“`} ·{" "}
          <Link href="/gruppen" className="text-primary hover:underline">
            Filter zurücksetzen
          </Link>
        </p>
      )}

      {mine.length > 0 && !q && !region && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Meine Gruppen</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mine.map((g) => (
              <GroupCard key={g.id} g={g} />
            ))}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              <MapPin className="size-4 text-primary" /> Gruppen in deiner Region
            </h2>
            {user?.region && (
              <Link href={`/gruppen?region=${user.region}`} className="ml-auto text-xs text-primary hover:underline">
                Alle in {regionName}
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((g) => (
              <GroupCard key={g.id} g={g} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        {!q && !region && <h2 className="text-lg font-bold">Alle Gruppen</h2>}
        {found.items.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">Keine Gruppen gefunden.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {found.items.map((g) => (
              <GroupCard key={g.id} g={g} />
            ))}
          </div>
        )}
        <Pagination
          page={page}
          pages={Math.ceil(found.total / 24)}
          href={(p) => `/gruppen?${new URLSearchParams({ ...(q ? { q } : {}), ...(region ? { region } : {}), seite: String(p) })}`}
        />
      </section>
    </div>
  );
}
