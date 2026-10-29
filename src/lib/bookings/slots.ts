import { NIGHT_MIN, addDays, weekdayOf, zonedToUtc } from "./format";
import type { DaySlots } from "./types";

/**
 * Freie Slots berechnen (rein, ohne DB): Regeln − Ausnahmen − blockierende Buchungen,
 * plus Puffer, Mindestvorlauf und Zeitzone der Escort.
 */
export type Rule = { weekday: number; startMin: number; endMin: number };
export type Exception = { dateFrom: string; dateTo: string; kind: string; startMin: number | null; endMin: number | null };
export type Busy = { start: Date; end: Date };

type Interval = [number, number]; // Minuten seit lokaler Mitternacht

export type SlotInput = {
  timezone: string;
  rules: Rule[];
  exceptions: Exception[];
  busy: Busy[];
  bufferMin: number;
  minLeadMin: number;
  durationMin: number;
  fromDate: string; // lokales Datum YYYY-MM-DD
  days: number;
  now?: Date;
  stepMin?: number;
};

function merge(list: Interval[]): Interval[] {
  const sorted = [...list].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

function subtract(list: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const [a, b] of list) {
    if (cut[1] <= a || cut[0] >= b) out.push([a, b]);
    else {
      if (cut[0] > a) out.push([a, cut[0]]);
      if (cut[1] < b) out.push([cut[1], b]);
    }
  }
  return out;
}

/** Verfügbare Zeitfenster (Minuten) eines lokalen Tages. */
export function dayWindows(date: string, rules: Rule[], exceptions: Exception[]): Interval[] {
  const wd = weekdayOf(date);
  let windows: Interval[] = rules.filter((r) => r.weekday === wd).map((r) => [r.startMin, Math.min(r.endMin, 1440)]);
  const todays = exceptions.filter((e) => e.dateFrom <= date && e.dateTo >= date);
  for (const e of todays.filter((x) => x.kind === "extra")) {
    windows.push([e.startMin ?? 0, e.endMin ?? 1440]);
  }
  windows = merge(windows);
  for (const e of todays.filter((x) => x.kind !== "extra")) {
    windows = subtract(windows, [e.startMin ?? 0, e.endMin ?? 1440]);
  }
  return windows;
}

export function computeSlots(input: SlotInput): DaySlots[] {
  const now = (input.now ?? new Date()).getTime();
  const step = input.stepMin ?? 30;
  const earliest = now + input.minLeadMin * 60_000;
  const buffer = input.bufferMin * 60_000;
  const dur = input.durationMin;
  const night = dur >= NIGHT_MIN;
  const busy = input.busy.map((b) => [b.start.getTime() - buffer, b.end.getTime() + buffer] as const);
  const result: DaySlots[] = [];
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.fromDate, i);
    const slots: DaySlots["slots"] = [];
    for (const [a, b] of dayWindows(date, input.rules, input.exceptions)) {
      // Nacht: Beginn im Fenster genügt; sonst muss der ganze Termin ins Fenster passen.
      const lastStart = night ? b - step : b - dur;
      const first = Math.ceil(a / step) * step;
      for (let m = first; m <= lastStart; m += step) {
        const start = zonedToUtc(date, m, input.timezone);
        const end = new Date(start.getTime() + dur * 60_000);
        if (start.getTime() < earliest) continue;
        if (busy.some(([bs, be]) => start.getTime() < be && end.getTime() > bs)) continue;
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
    result.push({ date, slots });
  }
  return result;
}

/** Prüft, ob ein konkreter Beginn zu den freien Slots gehört (serverseitige Validierung). */
export function isSlotFree(input: Omit<SlotInput, "fromDate" | "days">, start: Date, localDay: string) {
  const days = computeSlots({ ...input, fromDate: localDay, days: 1 });
  return days[0]?.slots.some((s) => new Date(s.start).getTime() === start.getTime()) ?? false;
}
