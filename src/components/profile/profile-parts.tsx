import { CheckCircle2, Clock } from "lucide-react";
import type { OpeningHours, PriceItem } from "@/db/schema";
import { DURATIONS, WEEKDAYS, labelOf } from "@/lib/profile/fields";
import { openState, zurichNow } from "@/lib/profiles/hours";
import { cn, formatPrice } from "@/lib/utils";

export function Panel({ title, children, className, action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold tracking-wide uppercase">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export type Fact = { label: string; value: React.ReactNode };

/** Steckbrief als zweispaltige Liste. */
export function FactsList({ facts }: { facts: Fact[] }) {
  const shown = facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== "" && f.value !== false);
  if (!shown.length) return <p className="text-xs text-muted-foreground">Keine Angaben.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
      {shown.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-muted-foreground">{f.label}</dt>
          <dd className="min-w-0 text-right font-medium">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PriceTable({ prices, currency = "CHF" }: { prices: PriceItem[]; currency?: string }) {
  if (!prices.length) return <p className="text-xs text-muted-foreground">Preise auf Anfrage.</p>;
  return (
    <ul className="divide-y text-[13px]">
      {[...prices]
        .sort((a, b) => a.minutes - b.minutes)
        .map((p) => (
          <li key={p.minutes} className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">{p.label ?? labelOf(DURATIONS, String(p.minutes))}</span>
            <span className="font-semibold tabular-nums">{formatPrice(p.price, currency)}</span>
          </li>
        ))}
    </ul>
  );
}

/** Wochenansicht (Öffnungs- oder Arbeitszeiten), heutiger Tag hervorgehoben. */
export function HoursList({ hours, emptyText = "Keine Zeiten hinterlegt." }: { hours: Partial<OpeningHours>; emptyText?: string }) {
  const today = zurichNow().day;
  if (!Object.values(hours).some((r) => r && r.length)) return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-1 text-[13px]">
      {WEEKDAYS.map((d) => {
        const ranges = hours[d.key] ?? [];
        return (
          <li key={d.key} className={cn("flex justify-between gap-3 rounded px-1.5 py-0.5", d.key === today && "bg-secondary font-semibold")}>
            <span className={cn(d.key !== today && "text-muted-foreground")}>{d.label}</span>
            <span className="text-right tabular-nums">{ranges.length ? ranges.map((r) => `${r.from}–${r.to}`).join(", ") : <span className="text-muted-foreground">geschlossen</span>}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function OpenBadge({ hours }: { hours: Partial<OpeningHours> }) {
  const s = openState(hours);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", s.open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", s.open ? "bg-success" : "bg-muted-foreground")} />
      {s.open ? `Jetzt geöffnet${s.until ? ` · bis ${s.until}` : ""}` : `Geschlossen${s.next ? ` · ${s.next}` : ""}`}
    </span>
  );
}

/** Verfügbarkeitsregeln (Minuten seit Mitternacht, 0 = Montag) → Wochen-Zeiten. */
export function rulesToHours(rules: { weekday: number; startMin: number; endMin: number }[]): Partial<OpeningHours> {
  const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: Partial<OpeningHours> = {};
  for (const r of [...rules].sort((a, b) => a.startMin - b.startMin)) {
    const key = WEEKDAYS[r.weekday]?.key;
    if (!key) continue;
    (out[key] ??= []).push({ from: fmt(r.startMin), to: fmt(r.endMin) });
  }
  return out;
}

export function ChipList({ items, icon = true }: { items: string[]; icon?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li key={s} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
          {icon && <CheckCircle2 className="size-3 text-success" />}
          {s}
        </li>
      ))}
    </ul>
  );
}

export function ClockHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Clock className="size-3" /> {children}
    </p>
  );
}
