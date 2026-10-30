/**
 * Präferenzen der Mitglieder: gleiche Attribute wie die Escort-Felder, jedes Kriterium mit
 * Gewichtung "muss" (harter Filter) oder "schoen" (gewichtete Punkte). Rein, auch im Client nutzbar.
 * Gespeichert verschlüsselt (AES-GCM) in preferences.criteria_enc – nie öffentlich.
 */
import { z } from "zod";
import { findCity } from "@/lib/geo/cities";
import { ESCORT_LISTS, RANGES, type EscortListKey, type RangeKey } from "@/lib/search/filters";

export const WEIGHTS = ["muss", "schoen"] as const;
export type Weight = (typeof WEIGHTS)[number];
export const WEIGHT_LABELS: Record<Weight, string> = { muss: "Muss", schoen: "Wäre schön" };

const weight = z.enum(WEIGHTS);
const rangeCrit = (key: RangeKey) =>
  z
    .object({ min: z.number().int(), max: z.number().int(), w: weight })
    .transform((r) => {
      const [lo, hi] = RANGES[key];
      const a = Math.max(lo, Math.min(hi, r.min));
      const b = Math.max(lo, Math.min(hi, r.max));
      return { min: Math.min(a, b), max: Math.max(a, b), w: r.w };
    })
    .optional();
const listCrit = (key: EscortListKey) =>
  z
    .object({ values: z.array(z.string()).max(60), w: weight })
    .transform((l) => ({ values: [...new Set(l.values)].filter((v) => ESCORT_LISTS[key].includes(v)), w: l.w }))
    .optional();

export const CriteriaSchema = z.object({
  alter: rangeCrit("alter"),
  groesse: rangeCrit("groesse"),
  gewicht: rangeCrit("gewicht"),
  preis: rangeCrit("preis"),
  geschlecht: listCrit("geschlecht"),
  nat: listCrit("nat"),
  sprachen: listCrit("sprachen"),
  cup: listCrit("cup"),
  brust: listCrit("brust"),
  intim: listCrit("intim"),
  piercings: listCrit("piercings"),
  tattoos: listCrit("tattoos"),
  stil: listCrit("stil"),
  kleidung: listCrit("kleidung"),
  schuhe: listCrit("schuhe"),
  haare: listCrit("haare"),
  augen: listCrit("augen"),
  services: listCrit("services"),
  ort: z.object({ value: z.enum(["incall", "outcall"]), w: weight }).optional(),
  region: z
    .object({ stadt: z.string().max(80), radius: z.number().int().min(1).max(200), w: weight })
    .transform((r) => ({ ...r, stadt: findCity(r.stadt)?.name ?? "" }))
    .optional(),
});

export type Criteria = z.output<typeof CriteriaSchema>;
export type CriteriaInput = z.input<typeof CriteriaSchema>;
export type CriterionKey = keyof Criteria;
export type RangeCriterion = { min: number; max: number; w: Weight };
export type ListCriterion = { values: string[]; w: Weight };

export const RANGE_KEYS = ["alter", "groesse", "gewicht", "preis"] as const satisfies readonly RangeKey[];
export const LIST_KEYS = Object.keys(ESCORT_LISTS) as EscortListKey[];

/** Grundgewicht je Kriterium für "Wäre schön"-Punkte. */
export const CRITERION_POINTS: Record<CriterionKey, number> = {
  alter: 3,
  region: 3,
  services: 3,
  geschlecht: 3,
  gewicht: 2,
  preis: 2,
  sprachen: 2,
  ort: 2,
  groesse: 1,
  nat: 1,
  cup: 1,
  brust: 1,
  intim: 1,
  piercings: 1,
  tattoos: 1,
  stil: 1,
  kleidung: 1,
  schuhe: 1,
  haare: 1,
  augen: 1,
};

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  alter: "Alter",
  groesse: "Grösse",
  gewicht: "Figur / Gewicht",
  preis: "Preis (1 Stunde)",
  geschlecht: "Geschlecht",
  nat: "Nationalität",
  sprachen: "Sprachen",
  cup: "Körbchengrösse",
  brust: "Brusttyp",
  intim: "Intimbereich",
  piercings: "Piercings",
  tattoos: "Tätowierungen",
  stil: "Kleidungsstil",
  kleidung: "Kleidergrösse",
  schuhe: "Schuhgrösse",
  haare: "Haarfarbe",
  augen: "Augenfarbe",
  services: "Services",
  ort: "Treffpunkt",
  region: "Region & Umkreis",
};

/** Leere Kriterien entfernen (leere Listen, Region ohne Stadt). */
export function cleanCriteria(c: Criteria): Criteria {
  const out: Criteria = {};
  for (const [k, v] of Object.entries(c) as [CriterionKey, Criteria[CriterionKey]][]) {
    if (!v) continue;
    if ("values" in v && v.values.length === 0) continue;
    if ("stadt" in v && !v.stadt) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function criteriaCount(c: Criteria) {
  const entries = Object.values(c).filter(Boolean) as { w: Weight }[];
  return { total: entries.length, muss: entries.filter((e) => e.w === "muss").length };
}
