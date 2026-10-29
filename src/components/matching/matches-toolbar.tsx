"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { SingleSlider, TogglePill } from "@/components/search/fields";
import { Select } from "@/components/shared/select/select";
import { MATCH_SORT_LABELS, MATCH_SORTS, matchHref, type MatchQuery, type MatchSort } from "@/lib/matching/query";
import { cn } from "@/lib/utils";

/** Filter (Typ, Mindest-Score, heute verfügbar) und Sortierung der Matches – Zustand in der URL. */
export function MatchesToolbar({ q, counts }: { q: MatchQuery; counts: { escort: number; club: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (patch: Partial<MatchQuery>) => start(() => router.push(matchHref({ ...q, seite: 1, ...patch }), { scroll: false }));
  const tabs = [
    { v: "alle" as const, label: "Alle", n: counts.escort + counts.club },
    { v: "escort" as const, label: "Escorts", n: counts.escort },
    { v: "club" as const, label: "Clubs & Studios", n: counts.club },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 md:flex-row md:items-center md:gap-4" aria-busy={pending}>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.v}
            type="button"
            aria-pressed={q.typ === t.v}
            onClick={() => go({ typ: t.v })}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              q.typ === t.v ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} <span className="opacity-70">{t.n}</span>
          </button>
        ))}
        <TogglePill active={q.heute} onClick={() => go({ heute: !q.heute })}>
          <CalendarCheck /> Heute verfügbar
        </TogglePill>
      </div>
      <div className="w-full md:w-44">
        <SingleSlider label="Mindest-Score" min={0} max={100} step={5} value={q.min} format={(n) => (n === 0 ? "Alle" : `ab ${n} %`)} onChange={(min) => go({ min })} />
      </div>
      <div className="md:ml-auto">
        <Select
          options={MATCH_SORTS.map((s) => ({ value: s, label: MATCH_SORT_LABELS[s] }))}
          value={q.sort}
          onChange={(v) => v && go({ sort: v as MatchSort })}
          aria-label="Sortierung"
          sheetTitle="Sortieren nach"
          className="min-h-8 w-36 text-xs [&>button]:min-h-8 [&>button]:py-1 [&>button]:pr-8"
        />
      </div>
    </div>
  );
}
