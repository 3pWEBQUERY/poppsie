"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "7", label: "7 Tage" },
  { value: "30", label: "30 Tage" },
  { value: "90", label: "90 Tage" },
  { value: "frei", label: "Frei" },
];
const UNITS = [
  { value: "tag", label: "Tag" },
  { value: "woche", label: "Woche" },
  { value: "monat", label: "Monat" },
];

function Seg({ items, value, onPick, label }: { items: { value: string; label: string }[]; value: string; onPick: (v: string) => void; label: string }) {
  return (
    <div className="flex rounded-md border p-0.5" role="group" aria-label={label}>
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          aria-pressed={value === i.value}
          onClick={() => onPick(i.value)}
          className={cn("rounded px-3 py-1 text-xs font-medium transition-colors", value === i.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

/** Zeitraum (7/30/90 Tage oder frei) und Einheit (Tag/Woche/Monat) über die URL. */
export function PeriodPicker({ preset, unit, fromDate, toDate, today }: { preset: string; unit: "day" | "week" | "month"; fromDate: string; toDate: string; today: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);
  const [custom, setCustom] = useState(preset === "frei");

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`${path}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Seg
        label="Zeitraum"
        items={PRESETS}
        value={custom ? "frei" : preset}
        onPick={(v) => {
          if (v === "frei") return setCustom(true);
          setCustom(false);
          go({ zeitraum: v, von: null, bis: null, einheit: null });
        }}
      />
      {custom && (
        <div className="flex items-center gap-1.5">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" aria-label="Von" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" aria-label="Bis" />
          <Button size="sm" onClick={() => go({ zeitraum: "frei", von: from, bis: to })}>
            Anwenden
          </Button>
        </div>
      )}
      <Seg label="Einheit" items={UNITS} value={unit === "day" ? "tag" : unit === "week" ? "woche" : "monat"} onPick={(v) => go({ einheit: v })} />
    </div>
  );
}
