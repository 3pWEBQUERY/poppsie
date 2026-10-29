/** Hilfen für Postgres-tstzrange-Werte (rein, auch im Worker und Client nutzbar). */

export function toRange(start: Date, end: Date) {
  return `[${start.toISOString()},${end.toISOString()})`;
}

/** Parst '["2026-10-29 14:00:00+00","2026-10-29 15:00:00+00")' bzw. die ISO-Variante. */
export function parseRange(value: string | null | undefined): { start: Date; end: Date } | null {
  if (!value) return null;
  const m = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(value.trim());
  if (!m) return null;
  const start = new Date(normalize(m[1]!));
  const end = new Date(normalize(m[2]!));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

// Postgres liefert "2026-10-29 14:00:00+00" – für Date in ISO-Form bringen.
function normalize(s: string) {
  let v = s.trim().replace(" ", "T");
  if (/[+-]\d\d$/.test(v)) v += ":00";
  return v;
}

/** Postgres-Fehler „exclusion_violation“ (Überlappung blockierender Buchungen). */
export function isOverlapError(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e && typeof e === "object"; i++) {
    const o = e as { code?: string; constraint?: string; cause?: unknown };
    if (o.code === "23P01" || o.constraint === "bookings_no_overlap") return true;
    e = o.cause;
  }
  return false;
}
