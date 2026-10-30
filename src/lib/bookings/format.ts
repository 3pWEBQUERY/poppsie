import { TZDate } from "@date-fns/tz";
import type { BookingStatus } from "./types";

/** Anzeige-Hilfen (rein, im Client, Server und Worker nutzbar). */

export const DEFAULT_TZ = "Europe/Zurich";
export const NIGHT_MIN = 720;
export const STANDARD_DURATIONS = [30, 60, 120, NIGHT_MIN] as const;

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Angefragt",
  countered: "Gegenvorschlag",
  confirmed: "Bestätigt",
  declined: "Abgelehnt",
  cancelled: "Storniert",
  completed: "Erledigt",
  no_show: "Nicht erschienen",
  expired: "Abgelaufen",
};

export const STATUS_VARIANT: Record<BookingStatus, "default" | "secondary" | "success" | "warning" | "muted" | "outline"> = {
  requested: "warning",
  countered: "warning",
  confirmed: "success",
  declined: "muted",
  cancelled: "muted",
  completed: "secondary",
  no_show: "muted",
  expired: "muted",
};

export function durationLabel(min: number) {
  if (min >= NIGHT_MIN) return "Nacht";
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h ${min % 60} min`;
}

export function minutesLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtDate(iso: string | Date, tz = DEFAULT_TZ, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) {
  return new Intl.DateTimeFormat("de-CH", { ...opts, timeZone: tz }).format(new Date(iso));
}

export function fmtTime(iso: string | Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function fmtDateTime(iso: string | Date, tz = DEFAULT_TZ) {
  return `${fmtDate(iso, tz)}, ${fmtTime(iso, tz)} Uhr`;
}

export function fmtRange(start: string | Date, end: string | Date, tz = DEFAULT_TZ) {
  const sameDay = localDate(start, tz) === localDate(end, tz);
  return sameDay ? `${fmtDate(start, tz)}, ${fmtTime(start, tz)}–${fmtTime(end, tz)} Uhr` : `${fmtDateTime(start, tz)} – ${fmtDateTime(end, tz)}`;
}

/** Lokales Datum 'YYYY-MM-DD' eines Zeitpunkts in einer Zeitzone. */
export function localDate(d: string | Date, tz = DEFAULT_TZ) {
  const t = new TZDate(new Date(d).getTime(), tz);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Minuten seit Mitternacht (lokal). */
export function localMinutes(d: string | Date, tz = DEFAULT_TZ) {
  const t = new TZDate(new Date(d).getTime(), tz);
  return t.getHours() * 60 + t.getMinutes();
}

/** Lokale Wandzeit (Datum + Minuten seit Mitternacht) → UTC-Zeitpunkt. DST-sicher. */
export function zonedToUtc(date: string, minutes: number, tz = DEFAULT_TZ) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, tz).getTime());
}

/** Wochentag 0 = Montag … 6 = Sonntag eines lokalen Datums. */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Montag der Woche eines lokalen Datums. */
export function mondayOf(date: string) {
  return addDays(date, -weekdayOf(date));
}

export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
