"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet, BottomSheetContent, BottomSheetFooter, BottomSheetHeader, BottomSheetTitle, BottomSheetTrigger } from "@/components/ui/bottom-sheet";
import { activeFilterCount, resetFilters, searchHref, type SearchFilters } from "@/lib/search/filters";
import { ClubFilterFields, type ClubFilterField } from "./club-filters";
import { EscortFilterFields } from "./escort-filters";
import { LocationPicker } from "./location-picker";

/** Navigiert zur Such-URL der Filter (ohne nach oben zu scrollen). */
export function useApplyFilters() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const apply = (f: SearchFilters, opts: { keepPage?: boolean } = {}) => start(() => router.push(searchHref(f, opts), { scroll: false }));
  return { apply, pending };
}

function Fields({ value, onChange, clubFields }: { value: SearchFilters; onChange: (f: SearchFilters) => void; clubFields: ClubFilterField[] }) {
  return (
    <div className="flex flex-col gap-4">
      <LocationPicker value={value} onChange={(patch) => onChange({ ...value, ...patch, seite: 1 } as SearchFilters)} />
      <div className="border-t pt-4">
        {value.typ === "escort" ? (
          <EscortFilterFields value={value} onChange={onChange} />
        ) : (
          <ClubFilterFields value={value} onChange={onChange} fields={clubFields} />
        )}
      </div>
    </div>
  );
}

/** Desktop-Sidebar: Änderungen werden nach kurzer Pause automatisch angewendet. */
export function FilterSidebar({ filters, clubFields }: { filters: SearchFilters; clubFields: ClubFilterField[] }) {
  const { apply, pending } = useApplyFilters();
  const urlKey = searchHref(filters);
  const [draft, setDraft] = useState(filters);
  const [synced, setSynced] = useState(urlKey);
  const [pushed, setPushed] = useState(urlKey);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL von aussen geändert (Zurück, Sortierung, mobiles Panel): Entwurf übernehmen.
  if (synced !== urlKey) {
    setSynced(urlKey);
    if (urlKey !== pushed) {
      setDraft(filters);
      setPushed(urlKey);
    }
  }

  const change = (next: SearchFilters) => {
    setDraft(next);
    setPushed(searchHref(next));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(next), 350);
  };

  const n = activeFilterCount(draft);
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4" aria-busy={pending}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Filter</h2>
        {n > 0 && (
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => change(resetFilters(draft))}>
            Zurücksetzen ({n})
          </button>
        )}
      </div>
      <Fields value={draft} onChange={change} clubFields={clubFields} />
    </div>
  );
}

/** Mobile: Filter im Bottom-Sheet, angewendet per Button. */
export function FilterSheetButton({ filters, clubFields, total }: { filters: SearchFilters; clubFields: ClubFilterField[]; total: number }) {
  const { apply } = useApplyFilters();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const n = activeFilterCount(filters);
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(filters);
        setOpen(o);
      }}
    >
      <BottomSheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <SlidersHorizontal /> Filter{n > 0 ? ` (${n})` : ""}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent size="tall">
        <BottomSheetHeader className="flex-row items-center justify-between">
          <BottomSheetTitle>Filter</BottomSheetTitle>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setDraft(resetFilters(draft))}>
            Zurücksetzen
          </button>
        </BottomSheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <Fields value={draft} onChange={setDraft} clubFields={clubFields} />
        </div>
        <BottomSheetFooter>
          <Button
            className="flex-1"
            onClick={() => {
              setOpen(false);
              apply(draft);
            }}
          >
            {searchHref(draft) === searchHref(filters) ? `${total} Ergebnisse anzeigen` : "Ergebnisse anzeigen"}
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}
