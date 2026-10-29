"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flag } from "@/components/shared/flag";
import { CONTINENT_LABELS, CONTINENTS, countryName, type ContinentKey } from "@/lib/geo/countries";
import { setCountryBlocks } from "@/lib/profiles/privacy-actions";
import { cn } from "@/lib/utils";

type Country = { code: string; name: string; continent: ContinentKey };

const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

function CountryRow({ c, blocked, onToggle, showContinent }: { c: Country; blocked: boolean; onToggle: (v: boolean) => void; showContinent?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors", blocked ? "border-primary/50 bg-primary/10" : "bg-card hover:border-foreground/30")}>
      <Flag code={c.code} className="size-6" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{c.name}</span>
        {showContinent && <span className="block text-[11px] text-muted-foreground">{CONTINENT_LABELS[c.continent]}</span>}
      </span>
      {blocked && <span className="text-[11px] font-semibold text-primary">Gesperrt</span>}
      <Switch checked={blocked} onCheckedChange={onToggle} aria-label={`${c.name} sperren`} />
    </label>
  );
}

/**
 * Länder-Sperre: Tabs je Kontinent mit Zähler, Suche über alle Kontinente,
 * "Alle sperren" / "Alle freigeben" pro Kontinent.
 */
export function CountryBlocker({ initialBlocked, ownCountry }: { initialBlocked: string[]; ownCountry: string | null }) {
  const [blocked, setBlocked] = useState(() => new Set(initialBlocked));
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ContinentKey>("europe");
  const [, start] = useTransition();

  const byContinent = useMemo(() => {
    const out = {} as Record<ContinentKey, Country[]>;
    for (const [k, codes] of Object.entries(CONTINENTS) as [ContinentKey, readonly string[]][]) {
      out[k] = codes.map((code) => ({ code, name: countryName(code, "de"), continent: k })).sort((a, b) => a.name.localeCompare(b.name, "de"));
    }
    return out;
  }, []);
  const all = useMemo(() => Object.values(byContinent).flat(), [byContinent]);

  const q = normalize(query.trim());
  const results = q ? all.filter((c) => normalize(c.name).includes(q) || c.code.toLowerCase() === q).sort((a, b) => a.name.localeCompare(b.name, "de")) : [];

  const apply = (codes: string[], value: boolean) => {
    const prev = new Set(blocked);
    const next = new Set(blocked);
    for (const c of codes) {
      if (value) next.add(c);
      else next.delete(c);
    }
    setBlocked(next);
    start(async () => {
      const res = await setCountryBlocks(codes, value);
      if (!res.ok) {
        setBlocked(prev);
        toast.error(res.error);
      } else setBlocked(new Set(res.data.blocked));
    });
  };

  const count = (k: ContinentKey) => byContinent[k].filter((c) => blocked.has(c.code)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Land suchen (alle Kontinente)" aria-label="Land suchen" className="pl-9" />
        {query && (
          <button type="button" aria-label="Suche leeren" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      {ownCountry && blocked.has(ownCountry) && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          Du hast dein eigenes Land ({countryName(ownCountry)}) gesperrt. Besucher von dort sehen dein Profil nicht mehr.
        </p>
      )}

      {q ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? "Treffer" : "Treffer"} für „{query.trim()}“
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((c) => (
              <CountryRow key={c.code} c={c} blocked={blocked.has(c.code)} onToggle={(v) => apply([c.code], v)} showContinent />
            ))}
          </div>
          {results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Kein Land gefunden.</p>}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as ContinentKey)}>
          <TabsList className="flex-nowrap overflow-x-auto [scrollbar-width:none]">
            {(Object.keys(CONTINENTS) as ContinentKey[]).map((k) => {
              const n = count(k);
              return (
                <TabsTrigger key={k} value={k} className="h-7 px-3 text-xs">
                  {CONTINENT_LABELS[k]}
                  {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-bold text-white">{n}</span>}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {(Object.keys(CONTINENTS) as ContinentKey[]).map((k) => {
            const list = byContinent[k];
            const n = count(k);
            return (
              <TabsContent key={k} value={k} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <strong>{n}</strong> von {list.length} gesperrt
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={n === list.length} onClick={() => apply(list.map((c) => c.code), true)}>
                      Alle sperren
                    </Button>
                    <Button size="sm" variant="outline" disabled={n === 0} onClick={() => apply(list.map((c) => c.code), false)}>
                      Alle freigeben
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((c) => (
                    <CountryRow key={c.code} c={c} blocked={blocked.has(c.code)} onToggle={(v) => apply([c.code], v)} />
                  ))}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
