import { addDays, localDate, zonedToUtc } from "@/lib/bookings/format";

/** Zeitraum und Zeiteinheit der Statistik (rein). */
export type Unit = "day" | "week" | "month";
export type Period = { preset: "7" | "30" | "90" | "frei"; fromDate: string; toDate: string; unit: Unit; tz: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePeriod(sp: Record<string, string | string[] | undefined>, tz: string): Period {
  const today = localDate(new Date(), tz);
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const preset = (["7", "30", "90", "frei"] as const).find((p) => p === get("zeitraum")) ?? "30";
  let fromDate = addDays(today, -(Number(preset === "frei" ? 30 : preset) - 1));
  let toDate = today;
  if (preset === "frei") {
    const v = get("von");
    const b = get("bis");
    if (v && DATE.test(v)) fromDate = v;
    if (b && DATE.test(b)) toDate = b > today ? today : b;
    if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
    if (daysBetween(fromDate, toDate) > 366) fromDate = addDays(toDate, -365);
  }
  const days = daysBetween(fromDate, toDate) + 1;
  const wanted = get("einheit");
  const unit: Unit = wanted === "woche" ? "week" : wanted === "monat" ? "month" : wanted === "tag" ? "day" : days > 120 ? "month" : days > 45 ? "week" : "day";
  return { preset, fromDate, toDate, unit, tz };
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);
}

/** UTC-Grenzen [from, to) eines lokalen Datumsbereichs und der gleich langen Vorperiode. */
export function bounds(p: Period) {
  const len = daysBetween(p.fromDate, p.toDate) + 1;
  const from = zonedToUtc(p.fromDate, 0, p.tz);
  const to = zonedToUtc(addDays(p.toDate, 1), 0, p.tz);
  const prevFromDate = addDays(p.fromDate, -len);
  const prevFrom = zonedToUtc(prevFromDate, 0, p.tz);
  return { from, to, prevFrom, prevTo: from, len, prevFromDate, prevToDate: addDays(p.fromDate, -1) };
}

function bucketOf(date: string, unit: Unit) {
  if (unit === "day") return date;
  if (unit === "month") return `${date.slice(0, 7)}-01`;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(date, -wd);
}

/** Bucket-Schlüssel (lokales Startdatum) zwischen zwei lokalen Daten, wie date_trunc in SQL. */
export function bucketKeys(fromDate: string, toDate: string, unit: Unit) {
  const keys: string[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    const k = bucketOf(d, unit);
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  return keys;
}

export function bucketLabel(key: string, unit: Unit) {
  const [, m, d] = key.split("-");
  if (unit === "month") return new Intl.DateTimeFormat("de-CH", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  if (unit === "week") return `KW ${isoWeek(key)}`;
  return `${d}.${m}.`;
}

function isoWeek(date: string) {
  const t = new Date(`${date}T00:00:00Z`);
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}
