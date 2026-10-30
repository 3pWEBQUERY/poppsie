import type { OpeningHours } from "@/db/schema";

export type DayKey = keyof OpeningHours;
const KEYS: DayKey[] = ["mo", "di", "mi", "do", "fr", "sa", "so"];
const SHORT: Record<string, DayKey> = { Mon: "mo", Tue: "di", Wed: "mi", Thu: "do", Fri: "fr", Sat: "sa", Sun: "so" };

/** Aktuelle Zeit in Europe/Zurich: Wochentag, Minuten seit Mitternacht und Datum (YYYY-MM-DD). */
export function zurichNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: SHORT[parts.weekday!] ?? "mo",
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Heutiges Datum in der Schweiz (für "heute anwesend" und Besuchstage). */
export const zurichToday = () => zurichNow().date;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Ist jetzt geöffnet? Berücksichtigt Zeitfenster über Mitternacht (z. B. 20:00–04:00 vom Vortag).
 * Gibt zusätzlich zurück, bis wann bzw. ab wann.
 */
export function openState(hours: Partial<OpeningHours>, now = new Date()): { open: boolean; until?: string; next?: string } {
  const { day, minutes } = zurichNow(now);
  const idx = KEYS.indexOf(day);
  const prev = KEYS[(idx + 6) % 7]!;
  for (const r of hours[day] ?? []) {
    const f = toMin(r.from);
    const t = toMin(r.to);
    if (t > f ? minutes >= f && minutes < t : minutes >= f) return { open: true, until: r.to };
  }
  for (const r of hours[prev] ?? []) {
    const f = toMin(r.from);
    const t = toMin(r.to);
    if (t <= f && minutes < t) return { open: true, until: r.to };
  }
  const later = (hours[day] ?? []).map((r) => r.from).filter((f) => toMin(f) > minutes).sort()[0];
  return { open: false, next: later ? `heute ab ${later}` : undefined };
}

export const DAY_KEYS = KEYS;
