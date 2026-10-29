import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Breakdown } from "@/lib/stats/queries";
import { pctChange } from "@/lib/stats/period";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });

export function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  const pct = pctChange(cur, prev);
  if (pct === null) return <span className="text-xs text-success">neu</span>;
  if (Math.abs(pct) < 0.5)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" /> 0 %
      </span>
    );
  const good = invert ? pct < 0 : pct > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-success" : "text-destructive")} title="Veränderung zur Vorperiode">
      {pct > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {nf.format(Math.abs(pct))} %
    </span>
  );
}

/** Kennzahl mit Vergleich zur Vorperiode. */
export function KpiTile({ label, value, prev, suffix = "", decimals = 0 }: { label: string; value: number; prev?: number; suffix?: string; decimals?: number }) {
  const f = new Intl.NumberFormat("de-CH", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums">
        {f.format(value)}
        {suffix}
      </span>
      {prev !== undefined && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Delta cur={value} prev={prev} /> <span>vorher {f.format(prev)}{suffix}</span>
        </span>
      )}
    </div>
  );
}

/** Horizontale Balken (Anteil am Ganzen) mit Vorperiode als Text. */
export function BreakdownBars({ data, label, empty = "Noch keine Daten" }: { data: Breakdown; label: (k: string) => string; empty?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const shown = data.filter((d) => d.value > 0 || d.prev > 0).slice(0, 8);
  if (total === 0 && shown.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {shown.map((d) => (
        <li key={d.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{label(d.key)}</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="font-semibold">{nf.format(d.value)}</span>
              <span className="text-xs text-muted-foreground">{total ? `${Math.round((d.value / total) * 100)} %` : ""}</span>
              <Delta cur={d.value} prev={d.prev} />
            </span>
          </div>
          <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-[#e5484d]" style={{ width: `${total ? (d.value / total) * 100 : 0}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({ title, description, children, className, aside }: { title: string; description?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
