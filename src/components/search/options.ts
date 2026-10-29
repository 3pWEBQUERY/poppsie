/** Select-Optionen für Suche und Präferenzen (einmal pro Modul berechnet). */
import type { SelectOption } from "@/components/shared/select/select";
import { CITIES } from "@/lib/geo/cities";
import { countryOptions } from "@/lib/geo/countries";
import { languageOptions } from "@/lib/geo/languages";
import { SERVICE_GROUPS } from "@/lib/profile/fields";

let countries: SelectOption[] | null = null;
let languages: SelectOption[] | null = null;

export function nationalityOptions(): SelectOption[] {
  countries ??= countryOptions("de").map((o) => ({ ...o, flag: o.value }));
  return countries;
}

export function languageSelectOptions(): SelectOption[] {
  languages ??= languageOptions("de");
  return languages;
}

export const CITY_OPTIONS: SelectOption[] = CITIES.map((c) => ({
  value: c.name,
  label: c.name,
  flag: c.country,
  description: c.country === "CH" ? `Kanton ${c.region}` : c.region,
}));

export const SERVICE_OPTIONS: SelectOption[] = SERVICE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));
