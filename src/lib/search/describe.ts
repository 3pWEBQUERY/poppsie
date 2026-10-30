/** Lesbare Zusammenfassung von Suchfiltern (gespeicherte Suchen, Benachrichtigungen). Rein. */
import { countryName } from "@/lib/geo/countries";
import { languageName } from "@/lib/geo/languages";
import {
  ALL_SERVICES,
  BREAST_TYPES,
  CLOTHING_SIZES,
  CLOTHING_STYLES,
  CLUB_TYPES,
  CUP_SIZES,
  EYE_COLORS,
  GENDERS,
  HAIR_COLORS,
  INTIMATE,
  labelOf,
  PIERCINGS,
  SHOE_SIZES,
  TATTOOS,
} from "@/lib/profile/fields";
import { ESCORT_FLAGS, type EscortListKey, type RangeKey, type SearchFilters } from "./filters";

type Opt = { value: string; label: string };
const LIST_OPTS: Partial<Record<EscortListKey, Opt[]>> = {
  geschlecht: GENDERS,
  cup: CUP_SIZES,
  brust: BREAST_TYPES,
  intim: INTIMATE,
  piercings: PIERCINGS,
  tattoos: TATTOOS,
  stil: CLOTHING_STYLES,
  kleidung: CLOTHING_SIZES,
  schuhe: SHOE_SIZES,
  haare: HAIR_COLORS,
  augen: EYE_COLORS,
  services: ALL_SERVICES,
};
const LIST_PREFIX: Record<EscortListKey, string> = {
  geschlecht: "",
  nat: "Nationalität: ",
  sprachen: "Spricht ",
  cup: "Körbchen ",
  brust: "Brust: ",
  intim: "Intim: ",
  piercings: "Piercings: ",
  tattoos: "Tattoos: ",
  stil: "Stil: ",
  kleidung: "Grösse ",
  schuhe: "Schuhe ",
  haare: "Haare: ",
  augen: "Augen: ",
  services: "",
};
const RANGE_TEXT: Record<RangeKey, (a: number, b: number) => string> = {
  alter: (a, b) => `${a}–${b} Jahre`,
  groesse: (a, b) => `${a}–${b} cm`,
  gewicht: (a, b) => `${a}–${b} kg`,
  preis: (a, b) => `${a}–${b} CHF/h`,
};
const FLAG_TEXT: Record<(typeof ESCORT_FLAGS)[number], string> = {
  heute: "Heute verfügbar",
  neu: "Neu",
  verifiziert: "Foto verifiziert",
  story: "Mit Story",
};

function listLabel(key: EscortListKey, v: string) {
  if (key === "nat") return countryName(v);
  if (key === "sprachen") return languageName(v);
  return labelOf(LIST_OPTS[key] ?? [], v);
}

function place(f: SearchFilters) {
  if (f.stadt) return `${f.stadt} (${f.radius} km)`;
  if (f.lat != null) return `Mein Standort (${f.radius} km)`;
  return null;
}

/** Filter als kurze Chips, z. B. ["Zürich (25 km)", "20–30 Jahre", "Massage"]. */
export function describeFilters(f: SearchFilters): string[] {
  const out: string[] = [];
  const p = place(f);
  if (p) out.push(p);
  if (f.typ === "escort") {
    for (const k of Object.keys(RANGE_TEXT) as RangeKey[]) {
      const r = f[k];
      if (r) out.push(RANGE_TEXT[k](r[0], r[1]));
    }
    for (const k of Object.keys(LIST_PREFIX) as EscortListKey[]) {
      if (!f[k].length) continue;
      const labels = f[k].map((v) => listLabel(k, v));
      out.push(LIST_PREFIX[k] + (labels.length > 3 ? `${labels.slice(0, 3).join(", ")} +${labels.length - 3}` : labels.join(", ")));
    }
    if (f.ort) out.push(f.ort === "incall" ? "Incall" : "Outcall");
    if (f.bewertung) out.push(`ab ${f.bewertung} Sternen`);
    for (const k of ESCORT_FLAGS) if (f[k]) out.push(FLAG_TEXT[k]);
  } else {
    if (f.clubtyp.length) out.push(f.clubtyp.map((t) => labelOf(CLUB_TYPES, t)).join(", "));
    if (f.offen) out.push("Jetzt geöffnet");
    if (f.eintritt != null) out.push(`Eintritt bis ${f.eintritt} CHF`);
    if (f.wellness.length) out.push(`Wellness: ${f.wellness.join(", ")}`);
    const n = f.extra.bool.length + Object.keys(f.extra.multi).length + Object.keys(f.extra.min).length;
    if (n) out.push(`${n} weitere Filter`);
  }
  return out;
}

/** Vorschlag für den Namen einer gespeicherten Suche. */
export function suggestName(f: SearchFilters) {
  const what = f.typ === "club" ? (f.clubtyp.length === 1 ? labelOf(CLUB_TYPES, f.clubtyp[0]) : "Clubs & Studios") : "Escorts";
  const where = f.stadt ? ` in ${f.stadt}` : f.lat != null ? " in meiner Nähe" : "";
  return `${what}${where}`.slice(0, 80);
}
