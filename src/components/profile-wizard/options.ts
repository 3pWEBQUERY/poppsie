import type { SelectOption } from "@/components/shared/select/select";
import { CANTON_NAMES, countryName, countryOptions, SWISS_CANTONS } from "@/lib/geo/countries";
import { CITIES } from "@/lib/geo/cities";
import { languageOptions } from "@/lib/geo/languages";

let countries: SelectOption[] | null = null;
let languages: SelectOption[] | null = null;
let cities: SelectOption[] | null = null;

/** Alle Länder mit runder Flagge, Schweiz und Nachbarn zuerst. */
export function countrySelectOptions() {
  return (countries ??= countryOptions("de").map((o) => ({ ...o, flag: o.value })));
}

export function languageSelectOptions() {
  return (languages ??= languageOptions("de"));
}

/** Städte gruppiert nach Kanton bzw. Land. */
export function citySelectOptions() {
  return (cities ??= [...CITIES]
    .map((c) => ({
      value: c.name,
      label: c.name,
      group: c.country === "CH" ? (CANTON_NAMES[c.region as keyof typeof CANTON_NAMES] ?? c.region) : countryName(c.country),
      flag: c.country === "CH" ? undefined : c.country,
    }))
    .sort((a, b) => a.group.localeCompare(b.group, "de") || a.label.localeCompare(b.label, "de")));
}

export const CANTON_OPTIONS: SelectOption[] = SWISS_CANTONS.map((c) => ({ value: c, label: CANTON_NAMES[c] })).sort((a, b) => a.label.localeCompare(b.label, "de"));

export const toOptions = (list: { value: string; label: string }[]): SelectOption[] => list.map((o) => ({ value: o.value, label: o.label }));
