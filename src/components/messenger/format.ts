const TZ = "Europe/Zurich";

const dayKey = (d: Date) => d.toLocaleDateString("de-CH", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("de-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Kurzform für die Liste: Uhrzeit (heute), "Gestern", Wochentag oder Datum. */
export function listTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return timeOf(iso);
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86400_000))) return "Gestern";
  if (now.getTime() - d.getTime() < 6 * 86400_000) return d.toLocaleDateString("de-CH", { timeZone: TZ, weekday: "short" });
  return d.toLocaleDateString("de-CH", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Trenner im Verlauf: "Heute", "Gestern", "Montag, 3. November 2026". */
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return "Heute";
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86400_000))) return "Gestern";
  return d.toLocaleDateString("de-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function sameDay(a: string, b: string) {
  return dayKey(new Date(a)) === dayKey(new Date(b));
}

export function lastSeenLabel(iso: string | null) {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "Zuletzt online gerade eben";
  if (min < 60) return `Zuletzt online vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `Zuletzt online vor ${h} Std.`;
  return `Zuletzt online am ${new Date(iso).toLocaleDateString("de-CH", { timeZone: TZ, day: "2-digit", month: "2-digit" })}`;
}

export function duration(sec: number | null | undefined) {
  const s = Math.max(0, Math.round(sec ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
