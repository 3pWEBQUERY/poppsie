import { minutesLabel } from "@/lib/bookings/format";

/** Uhrzeiten als Select-Optionen (Minuten seit Mitternacht). */
export function timeOptions(step = 30, includeEnd = true) {
  const out: { value: string; label: string }[] = [];
  for (let m = 0; m < 1440; m += step) out.push({ value: String(m), label: minutesLabel(m) });
  if (includeEnd) out.push({ value: "1440", label: "24:00" });
  return out;
}
