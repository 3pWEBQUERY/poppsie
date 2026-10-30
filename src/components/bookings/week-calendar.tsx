import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, WEEKDAYS_SHORT, addDays, fmtTime, localDate, zonedToUtc } from "@/lib/bookings/format";
import { dayWindows, type Exception, type Rule } from "@/lib/bookings/slots";
import type { BookingView } from "@/lib/bookings/types";
import { cn } from "@/lib/utils";

const HOUR_PX = 36;
const HIDDEN = new Set(["declined", "cancelled", "expired"]);

const TONE: Record<string, string> = {
  confirmed: "border-primary bg-primary text-primary-foreground",
  requested: "border-warning bg-warning/20 text-foreground",
  countered: "border-warning bg-warning/10 text-foreground border-dashed",
  completed: "border-border bg-secondary text-foreground",
  no_show: "border-border bg-muted text-muted-foreground",
};

/** Wochenansicht (Server-Komponente): Verfügbarkeit hinterlegt, Buchungen als Blöcke. */
export function WeekCalendar({
  weekStart,
  timezone,
  bookings,
  rules,
  exceptions,
  hrefFor,
  viewerId,
}: {
  weekStart: string;
  timezone: string;
  bookings: BookingView[];
  rules: Rule[];
  exceptions: Exception[];
  hrefFor: (week: string) => string;
  viewerId: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = localDate(new Date(), timezone);
  // Gegenvorschläge an der vorgeschlagenen Zeit zeigen
  const visible = bookings
    .filter((b) => !HIDDEN.has(b.status))
    .map((b) => (b.status === "countered" && b.counterStart && b.counterEnd ? { ...b, start: b.counterStart, end: b.counterEnd } : b));

  // Sichtbarer Stundenbereich: aus Regeln und Buchungen, mindestens 10–22 Uhr
  let minH = 10;
  let maxH = 22;
  for (const d of days) {
    for (const [a, b] of dayWindows(d, rules, exceptions)) {
      minH = Math.min(minH, Math.floor(a / 60));
      maxH = Math.max(maxH, Math.ceil(b / 60));
    }
  }
  const segments = days.map((d) => {
    const dayStart = zonedToUtc(d, 0, timezone).getTime();
    const dayEnd = zonedToUtc(addDays(d, 1), 0, timezone).getTime();
    return visible
      .filter((b) => new Date(b.start).getTime() < dayEnd && new Date(b.end).getTime() > dayStart)
      .map((b) => {
        const s = Math.max(new Date(b.start).getTime(), dayStart);
        const e = Math.min(new Date(b.end).getTime(), dayEnd);
        const fromMin = (s - dayStart) / 60_000;
        const toMin = (e - dayStart) / 60_000;
        minH = Math.min(minH, Math.floor(fromMin / 60));
        maxH = Math.max(maxH, Math.ceil(toMin / 60));
        return { b, fromMin, toMin };
      });
  });
  maxH = Math.min(24, maxH);
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
  const top = (min: number) => ((min - minH * 60) / 60) * HOUR_PX;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={hrefFor(addDays(weekStart, -7))} aria-label="Vorherige Woche" scroll={false}>
            <ChevronLeft />
          </Link>
        </Button>
        <span className="text-sm font-semibold">
          {days[0]!.slice(8, 10)}.{days[0]!.slice(5, 7)}. – {days[6]!.slice(8, 10)}.{days[6]!.slice(5, 7)}.{days[6]!.slice(0, 4)}
        </span>
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={hrefFor(addDays(weekStart, 7))} aria-label="Nächste Woche" scroll={false}>
            <ChevronRight />
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[40px_repeat(7,1fr)] rounded-md border">
          <div className="border-b" />
          {days.map((d, i) => (
            <div key={d} className={cn("border-b border-l px-1 py-1.5 text-center text-xs", d === today && "bg-primary/10")}>
              <div className="font-semibold">{WEEKDAYS_SHORT[i]}</div>
              <div className="text-muted-foreground">
                {d.slice(8, 10)}.{d.slice(5, 7)}.
              </div>
            </div>
          ))}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums" style={{ top: top(h * 60) }}>
                {h > minH ? `${h}:00` : ""}
              </span>
            ))}
          </div>
          {days.map((d, i) => (
            <div key={d} className="relative border-l" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: top(h * 60) }} />
              ))}
              {dayWindows(d, rules, exceptions).map(([a, b]) => (
                <div key={a} className="absolute inset-x-0 bg-success/10" style={{ top: top(Math.max(a, minH * 60)), height: top(Math.min(b, maxH * 60)) - top(Math.max(a, minH * 60)) }} />
              ))}
              {segments[i]!.map(({ b, fromMin, toMin }) => (
                <a
                  key={b.id}
                  href={`#buchung-${b.id}`}
                  title={`${STATUS_LABEL[b.status]} · ${viewerId === b.escortId ? b.memberName : b.escortName}`}
                  className={cn("absolute inset-x-0.5 overflow-hidden rounded border px-1 py-0.5 text-[10px] leading-tight", TONE[b.status])}
                  style={{ top: top(fromMin) + 1, height: Math.max(16, top(toMin) - top(fromMin) - 2) }}
                >
                  <span className="block font-semibold tabular-nums">{fmtTime(b.start, timezone)}</span>
                  <span className="block truncate">{viewerId === b.escortId ? b.memberName : b.escortName}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Legend cls="bg-success/30" label="Verfügbar" />
        <Legend cls="bg-warning/40" label="Angefragt" />
        <Legend cls="bg-primary" label="Bestätigt" />
        <Legend cls="bg-secondary" label="Erledigt" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", cls)} /> {label}
    </span>
  );
}
