/** Zeit-Helfer in Europe/Zurich (rein, auch im Worker nutzbar). */
import type { OpeningHours } from "@/db/schema";

export const TZ = "Europe/Zurich";
const DAY_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Wochentag (0 = Montag), Datum (YYYY-MM-DD) und Uhrzeit (HH:MM) in Zürich. */
export function zurichNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
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
  const weekday = WEEKDAY_INDEX[parts.weekday!] ?? 0;
  return {
    weekday,
    dayKey: DAY_KEYS[weekday]!,
    prevDayKey: DAY_KEYS[(weekday + 6) % 7]!,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Ist der Betrieb jetzt geöffnet? Zeitfenster über Mitternacht (z. B. 20:00–04:00) werden berücksichtigt. */
export function isOpenNow(hours: Partial<OpeningHours> | null | undefined, now = new Date()) {
  if (!hours) return false;
  const z = zurichNow(now);
  const today = hours[z.dayKey] ?? [];
  const prev = hours[z.prevDayKey] ?? [];
  const overnight = (s: { from: string; to: string }) => s.to <= s.from;
  if (today.some((s) => s.from <= z.time && (s.to > z.time || overnight(s)))) return true;
  return prev.some((s) => overnight(s) && z.time < s.to);
}
