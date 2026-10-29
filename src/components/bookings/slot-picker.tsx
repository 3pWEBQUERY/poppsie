"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSlots } from "@/lib/bookings/actions";
import { WEEKDAYS_SHORT, addDays, fmtDate, fmtTime, localDate, weekdayOf } from "@/lib/bookings/format";
import type { DaySlots, Slot } from "@/lib/bookings/types";
import { cn } from "@/lib/utils";

/** Freie Termine in Tages- oder Wochenansicht (Zeiten in der Zeitzone der Escort). */
export function SlotPicker({
  escortId,
  durationMin,
  timezone,
  value,
  onChange,
  excludeBookingId,
  compact = false,
}: {
  escortId: string;
  durationMin: number;
  timezone: string;
  value: Slot | null;
  onChange: (slot: Slot) => void;
  excludeBookingId?: string;
  compact?: boolean;
}) {
  const today = localDate(new Date(), timezone);
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");

  useEffect(() => {
    let alive = true;
    fetchSlots({ escortId, durationMin, fromDate: from, days: 7, excludeBookingId }).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setDays(res.data);
        setError(null);
        const firstFree = res.data.find((d) => d.slots.length > 0);
        setSelected((cur) => (res.data.some((d) => d.date === cur && d.slots.length) ? cur : (firstFree?.date ?? from)));
      } else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [escortId, durationMin, from, excludeBookingId]);

  const loading = days === null || days[0]?.date !== from;
  const day = days?.find((d) => d.date === selected);
  const move = (n: number) => {
    const next = addDays(from, n);
    if (next < today) return;
    setDays(null);
    setFrom(next);
    setSelected(next);
  };

  const slotButton = (s: Slot) => {
    const active = value?.start === s.start;
    return (
      <button
        key={s.start}
        type="button"
        onClick={() => onChange(s)}
        aria-pressed={active}
        className={cn(
          "rounded-md border px-2 py-1.5 text-sm font-medium tabular-nums transition-colors",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground/40",
        )}
      >
        {fmtTime(s.start, timezone)}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => move(-7)} disabled={from <= today} aria-label="Vorherige Woche">
          <ChevronLeft />
        </Button>
        <span className="text-sm font-semibold">
          {fmtDate(`${from}T12:00:00Z`, "UTC", { day: "2-digit", month: "2-digit" })} – {fmtDate(`${addDays(from, 6)}T12:00:00Z`, "UTC", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </span>
        <div className="flex items-center gap-1">
          {!compact && (
            <div className="mr-1 hidden rounded-md border p-0.5 sm:flex" role="group" aria-label="Ansicht">
              {(["day", "week"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn("rounded px-2 py-0.5 text-xs font-medium", view === v ? "bg-secondary" : "text-muted-foreground")}
                >
                  {v === "day" ? "Tag" : "Woche"}
                </button>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="icon-sm" onClick={() => move(7)} aria-label="Nächste Woche">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {error ? null : loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : view === "week" && !compact ? (
        <div className="grid grid-cols-7 gap-1.5">
          {days!.map((d) => (
            <div key={d.date} className="flex min-w-0 flex-col gap-1.5">
              <div className="text-center text-xs">
                <div className="font-semibold">{WEEKDAYS_SHORT[weekdayOf(d.date)]}</div>
                <div className="text-muted-foreground">{d.date.slice(8, 10)}.{d.date.slice(5, 7)}.</div>
              </div>
              {d.slots.length === 0 ? <div className="text-center text-xs text-muted-foreground">–</div> : d.slots.map(slotButton)}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1">
            {days!.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelected(d.date)}
                aria-pressed={selected === d.date}
                className={cn(
                  "flex flex-col items-center rounded-md border px-1 py-1.5 text-xs transition-colors",
                  selected === d.date ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40",
                  d.slots.length === 0 && "opacity-50",
                )}
              >
                <span className="font-semibold">{WEEKDAYS_SHORT[weekdayOf(d.date)]}</span>
                <span className="text-muted-foreground">{d.date.slice(8, 10)}.</span>
                <span className={cn("mt-0.5 size-1.5 rounded-full", d.slots.length ? "bg-success" : "bg-transparent")} aria-hidden />
              </button>
            ))}
          </div>
          {day && day.slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">{day.slots.map(slotButton)}</div>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">An diesem Tag ist leider nichts frei.</p>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">Zeiten in {timezone.replace("_", " ")}.</p>
    </div>
  );
}
