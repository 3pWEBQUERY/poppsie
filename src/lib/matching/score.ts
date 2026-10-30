/**
 * Match-Score: "Muss"-Kriterien sind harte Filter (über den Such-Query-Builder),
 * "Wäre schön"-Kriterien bringen gewichtete Punkte → Prozent. Rein.
 */
import { ageFrom } from "@/lib/profile/fields";
import type { EscortRow } from "@/lib/search/escorts";
import { parseEscortFilters, RANGES, type EscortFilters } from "@/lib/search/filters";
import { CRITERION_POINTS, LIST_KEYS, RANGE_KEYS, type Criteria, type CriterionKey, type RangeCriterion } from "./criteria";

/** Muss-Kriterien als Suchfilter. */
export function mustFilters(c: Criteria): EscortFilters {
  const f = parseEscortFilters(new URLSearchParams());
  for (const k of RANGE_KEYS) {
    const r = c[k];
    if (r?.w === "muss" && !(r.min === RANGES[k][0] && r.max === RANGES[k][1])) f[k] = [r.min, r.max];
  }
  for (const k of LIST_KEYS) {
    const l = c[k];
    if (l?.w === "muss" && l.values.length) f[k] = l.values;
  }
  if (c.ort?.w === "muss") f.ort = c.ort.value;
  if (c.region?.w === "muss" && c.region.stadt) {
    f.stadt = c.region.stadt;
    f.radius = c.region.radius;
  }
  return f;
}

/** 1 im Bereich, ausserhalb linear abnehmend (Toleranz = ein Viertel der Bereichsbreite, mind. 2). */
function rangeFit(v: number | null | undefined, r: RangeCriterion) {
  if (v == null) return 0;
  if (v >= r.min && v <= r.max) return 1;
  const d = v < r.min ? r.min - v : v - r.max;
  const tol = Math.max(2, (r.max - r.min) * 0.25);
  return Math.max(0, 1 - d / tol);
}

const one = (v: string | number | null | undefined, values: string[]) => (v != null && values.includes(String(v)) ? 1 : 0);
const overlap = (arr: string[], values: string[]) => (arr.some((x) => values.includes(x)) ? 1 : 0);
const share = (arr: string[], values: string[]) => (values.length ? values.filter((x) => arr.includes(x)).length / values.length : 0);

function fitFor(k: CriterionKey, r: EscortRow, c: Criteria): number {
  switch (k) {
    case "alter":
      return rangeFit(ageFrom(r.birthDate), c.alter!);
    case "groesse":
      return rangeFit(r.heightCm, c.groesse!);
    case "gewicht":
      return rangeFit(r.weightKg, c.gewicht!);
    case "preis":
      return rangeFit(r.hourlyPrice, c.preis!);
    case "geschlecht":
      return one(r.gender, c.geschlecht!.values);
    case "nat":
      return one(r.nationality, c.nat!.values);
    case "cup":
      return one(r.cupSize, c.cup!.values);
    case "brust":
      return one(r.breastType, c.brust!.values);
    case "intim":
      return one(r.intimate, c.intim!.values);
    case "tattoos":
      return one(r.tattoos, c.tattoos!.values);
    case "kleidung":
      return one(r.clothingSize, c.kleidung!.values);
    case "schuhe":
      return one(r.shoeSize, c.schuhe!.values);
    case "haare":
      return one(r.hairColor, c.haare!.values);
    case "augen":
      return one(r.eyeColor, c.augen!.values);
    case "piercings":
      return overlap(r.piercings, c.piercings!.values);
    case "stil":
      return overlap(r.clothingStyles, c.stil!.values);
    case "sprachen":
      return share(r.languages, c.sprachen!.values);
    case "services":
      return share(r.services, c.services!.values);
    case "ort":
      return r.workplace === "both" || r.workplace === c.ort!.value ? 1 : 0;
    case "region": {
      const d = r.distanceKm;
      if (d == null) return 0;
      const radius = c.region!.radius;
      return d <= radius ? 1 : Math.max(0, 1 - (d - radius) / radius);
    }
  }
}

/** Score in Prozent (0–100). Ohne "Wäre schön"-Kriterien erfüllt jeder Treffer 100 %. */
export function scoreEscort(r: EscortRow, c: Criteria): number {
  let got = 0;
  let max = 0;
  for (const k of Object.keys(c) as CriterionKey[]) {
    const crit = c[k];
    if (!crit || crit.w !== "schoen") continue;
    const p = CRITERION_POINTS[k];
    max += p;
    got += p * fitFor(k, r, c);
  }
  return max === 0 ? 100 : Math.round((got / max) * 100);
}
