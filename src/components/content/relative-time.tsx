"use client";

import { useEffect, useState } from "react";

const rtf = new Intl.RelativeTimeFormat("de-CH", { numeric: "auto" });
const full = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });
const short = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Zurich" });

export function formatRelative(iso: string, now = Date.now()) {
  const d = new Date(iso).getTime();
  const s = Math.round((d - now) / 1000);
  const a = Math.abs(s);
  if (a < 45) return "gerade eben";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 7 * 86400) return rtf.format(Math.round(s / 86400), "day");
  return short.format(d);
}

export const formatDateTime = (iso: string) => full.format(new Date(iso));

/** Relative Zeitangabe ("vor 5 Minuten"), aktualisiert sich jede Minute; Tooltip mit vollem Datum. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className} suppressHydrationWarning>
      {formatRelative(iso, now)}
    </time>
  );
}
