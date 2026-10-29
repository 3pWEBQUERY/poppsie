"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Beschriftetes Filterfeld. */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {hint && <span className="text-xs tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Bereichs-Slider mit Live-Anzeige; der Wert wird erst beim Loslassen übernommen.
 * value = null bedeutet "ganzer Bereich" (kein Filter).
 */
export function RangeField({
  label,
  min,
  max,
  step = 1,
  unit = "",
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
}) {
  const external = value ?? [min, max];
  const [live, setLive] = useState<[number, number]>(external);
  const [synced, setSynced] = useState(external.join("-"));
  if (synced !== external.join("-")) {
    setSynced(external.join("-"));
    setLive(external);
  }
  const fmt = (n: number) => `${n}${unit}`;
  const full = live[0] === min && live[1] === max;
  return (
    <Field label={label} hint={full ? <span className="text-muted-foreground">Alle</span> : `${fmt(live[0])} – ${fmt(live[1])}${live[1] === max ? "+" : ""}`}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={live}
        aria-label={label}
        onValueChange={(v) => setLive([v[0]!, v[1]!])}
        onValueCommit={(v) => onChange(v[0] === min && v[1] === max ? null : [v[0]!, v[1]!])}
        className="py-1.5"
      />
    </Field>
  );
}

/** Ein-Griff-Slider (z. B. Umkreis, Eintritt bis). */
export function SingleSlider({
  label,
  min,
  max,
  step = 1,
  value,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  format: (n: number) => string;
  onChange: (v: number) => void;
}) {
  const [live, setLive] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setLive(value);
  }
  return (
    <Field label={label} hint={format(live)}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[live]}
        aria-label={label}
        onValueChange={(v) => setLive(v[0]!)}
        onValueCommit={(v) => onChange(v[0]!)}
        className="py-1.5"
      />
    </Field>
  );
}

/** Pillen-Umschalter (z. B. "Heute verfügbar"). */
export function TogglePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors [&_svg]:size-3.5",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Einklappbarer Abschnitt im Filter-Panel. */
export function FilterSection({ title, count, defaultOpen = false, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t first:border-t-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 py-3 text-left text-sm font-semibold">
        <span className="flex-1">{title}</span>
        {count ? <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 font-bold text-white">{count}</span> : null}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-4 pb-4">{children}</div>}
    </section>
  );
}

/** Segment-Auswahl mit wenigen Optionen (z. B. Alle / Incall / Outcall). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 flex-1 rounded-[5px] px-2 text-xs font-medium transition-colors",
            value === o.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
