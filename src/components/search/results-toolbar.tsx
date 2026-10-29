"use client";

import { LayoutGrid, Map as MapIcon } from "lucide-react";
import { Select } from "@/components/shared/select/select";
import { SORT_LABELS, SORTS, type SearchFilters, type Sort } from "@/lib/search/filters";
import { cn } from "@/lib/utils";
import { useApplyFilters } from "./filter-panel";

/** Sortierung und Umschalter Raster/Karte. */
export function ResultsToolbar({ filters, hasOrigin }: { filters: SearchFilters; hasOrigin: boolean }) {
  const { apply } = useApplyFilters();
  const sortOptions = SORTS.map((s) => ({
    value: s,
    label: SORT_LABELS[s],
    description: s === "distanz" && !hasOrigin ? "Wähle zuerst einen Ort" : undefined,
  }));
  return (
    <div className="flex items-center gap-2">
      <Select
        options={sortOptions}
        value={filters.sort}
        onChange={(v) => v && apply({ ...filters, sort: v as Sort, seite: 1 })}
        aria-label="Sortierung"
        sheetTitle="Sortieren nach"
        className="min-h-8 w-32 text-xs sm:w-36 [&>button]:min-h-8 [&>button]:py-1 [&>button]:pr-8"
      />
      <div role="radiogroup" aria-label="Ansicht" className="flex rounded-md border p-0.5">
        {(
          [
            { v: "grid", label: "Raster", icon: LayoutGrid },
            { v: "karte", label: "Karte", icon: MapIcon },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={filters.ansicht === o.v}
            aria-label={o.label}
            title={o.label}
            onClick={() => apply({ ...filters, ansicht: o.v })}
            className={cn(
              "flex h-7 items-center gap-1 rounded-[5px] px-2 text-xs font-medium transition-colors",
              filters.ansicht === o.v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-4" />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
