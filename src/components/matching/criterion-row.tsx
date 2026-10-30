"use client";

import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { WEIGHT_LABELS, WEIGHTS, type Weight } from "@/lib/matching/criteria";
import { cn } from "@/lib/utils";

/** Umschalter "Muss" / "Wäre schön". */
export function WeightToggle({ value, onChange, disabled, label }: { value: Weight; onChange: (w: Weight) => void; disabled?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={`Gewichtung ${label}`} className={cn("flex shrink-0 rounded-full border p-0.5", disabled && "opacity-40")}>
      {WEIGHTS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={value === w}
          disabled={disabled}
          onClick={() => onChange(w)}
          className={cn(
            "h-6 rounded-full px-2.5 text-[11px] font-semibold transition-colors",
            value === w ? (w === "muss" ? "bg-primary text-white" : "bg-foreground text-background") : "text-muted-foreground hover:text-foreground",
          )}
        >
          {WEIGHT_LABELS[w]}
        </button>
      ))}
    </div>
  );
}

/**
 * Ein Kriterium: Titel, optionaler Aktiv-Schalter (für Bereiche), Gewichtung und Eingabe.
 * Ohne `onActiveChange` gilt das Kriterium als aktiv, sobald ein Wert gesetzt ist.
 */
export function CriterionRow({
  label,
  active,
  weight,
  onWeight,
  onActiveChange,
  children,
}: {
  label: string;
  active: boolean;
  weight: Weight;
  onWeight: (w: Weight) => void;
  onActiveChange?: (active: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-md border p-3 transition-colors", active ? "border-foreground/30 bg-background/40" : "")}>
      <div className="flex items-center gap-2">
        {onActiveChange && <Switch checked={active} onCheckedChange={onActiveChange} aria-label={`${label} berücksichtigen`} />}
        <span className="flex-1 text-sm font-semibold">{label}</span>
        <WeightToggle value={weight} onChange={onWeight} disabled={!active} label={label} />
      </div>
      {(active || !onActiveChange) && children}
    </div>
  );
}
