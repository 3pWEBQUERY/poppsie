/**
 * Suchfilter: Typen, Parsen aus URL-Parametern (zod) und Serialisieren zurück in die URL.
 * Rein (kein DB-Zugriff, kein next/headers): läuft im Client, auf dem Server und im Job-Worker.
 */
import { z } from "zod";
import { CITIES, findCity } from "@/lib/geo/cities";
import { ALL_COUNTRIES } from "@/lib/geo/countries";
import { LANGUAGE_CODES } from "@/lib/geo/languages";
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
  PIERCINGS,
  SHOE_SIZES,
  TATTOOS,
} from "@/lib/profile/fields";

export const RANGES = {
  alter: [18, 99],
  groesse: [140, 210],
  gewicht: [40, 150],
  preis: [0, 1000],
} as const satisfies Record<string, readonly [number, number]>;
export type RangeKey = keyof typeof RANGES;

export const RADIUS = { min: 1, max: 200, default: 25 } as const;
export const SORTS = ["distanz", "bewertung", "neu", "beliebt"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = { distanz: "Distanz", bewertung: "Bewertung", neu: "Neu", beliebt: "Beliebt" };
export const PAGE_SIZE = 24;
export const MAP_LIMIT = 300;
export const WELLNESS = ["Sauna", "Pool", "Whirlpool", "Dampfbad", "Ruhebereich"];

const values = (opts: { value: string }[]) => opts.map((o) => o.value);

/** Mehrfach-Filter der Escort-Suche mit erlaubten Werten. */
export const ESCORT_LISTS = {
  geschlecht: values(GENDERS),
  nat: ALL_COUNTRIES,
  sprachen: [...LANGUAGE_CODES] as string[],
  cup: values(CUP_SIZES),
  brust: values(BREAST_TYPES),
  intim: values(INTIMATE),
  piercings: values(PIERCINGS),
  tattoos: values(TATTOOS),
  stil: values(CLOTHING_STYLES),
  kleidung: values(CLOTHING_SIZES),
  schuhe: values(SHOE_SIZES),
  haare: values(HAIR_COLORS),
  augen: values(EYE_COLORS),
  services: values(ALL_SERVICES),
} satisfies Record<string, string[]>;
export type EscortListKey = keyof typeof ESCORT_LISTS;
export const ESCORT_FLAGS = ["heute", "neu", "verifiziert", "story"] as const;
export type EscortFlag = (typeof ESCORT_FLAGS)[number];

export type Range = [number, number] | null;

type Base = {
  stadt: string | null;
  lat: number | null;
  lng: number | null;
  radius: number;
  sort: Sort;
  seite: number;
  ansicht: "grid" | "karte";
};

export type EscortFilters = Base & {
  typ: "escort";
  ort: "incall" | "outcall" | null;
  bewertung: number | null;
} & Record<RangeKey, Range> &
  Record<EscortListKey, string[]> &
  Record<EscortFlag, boolean>;

/** Dynamische Club-Felder (aus club_type_schemas): Ja/Nein, enthält alle, Mindestwert. */
export type ClubExtra = { bool: string[]; multi: Record<string, string[]>; min: Record<string, number> };

export type ClubFilters = Base & {
  typ: "club";
  clubtyp: string[];
  offen: boolean;
  eintritt: number | null;
  wellness: string[];
  extra: ClubExtra;
};

export type SearchFilters = EscortFilters | ClubFilters;

type Input = URLSearchParams | Record<string, string | string[] | undefined>;

function getter(input: Input) {
  if (input instanceof URLSearchParams) return (k: string) => input.get(k) ?? undefined;
  return (k: string) => {
    const v = input[k];
    return Array.isArray(v) ? v[0] : v;
  };
}

function keysOf(input: Input) {
  return input instanceof URLSearchParams ? [...input.keys()] : Object.keys(input);
}

const optNumber = (min: number, max: number) => z.coerce.number().min(min).max(max).nullable().catch(null);
const intWithDefault = (min: number, max: number, def: number) => z.coerce.number().int().min(min).max(max).catch(def);
const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/;

function listOf(raw: string | undefined, allowed?: readonly string[], max = 40) {
  if (!raw) return [];
  const parts = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, max);
  return allowed ? parts.filter((p) => allowed.includes(p)) : parts.filter((p) => p.length <= 60);
}

function rangeOf(raw: string | undefined, key: RangeKey): Range {
  if (!raw) return null;
  const m = /^(\d{1,4})-(\d{1,4})$/.exec(raw);
  if (!m) return null;
  const [lo, hi] = RANGES[key];
  const a = Math.max(lo, Math.min(hi, Number(m[1])));
  const b = Math.max(lo, Math.min(hi, Number(m[2])));
  const r: [number, number] = a <= b ? [a, b] : [b, a];
  return r[0] === lo && r[1] === hi ? null : r;
}

function baseOf(get: (k: string) => string | undefined): Base {
  const city = get("stadt");
  const stadt = city ? (findCity(city)?.name ?? null) : null;
  const lat = optNumber(-90, 90).parse(get("lat"));
  const lng = optNumber(-180, 180).parse(get("lng"));
  const hasPos = lat != null && lng != null && !stadt;
  return {
    stadt,
    lat: hasPos ? Math.round(lat * 100) / 100 : null,
    lng: hasPos ? Math.round(lng * 100) / 100 : null,
    radius: intWithDefault(RADIUS.min, RADIUS.max, RADIUS.default).parse(get("radius")),
    sort: z.enum(SORTS).catch("distanz").parse(get("sort")),
    seite: intWithDefault(1, 500, 1).parse(get("seite")),
    ansicht: z.enum(["grid", "karte"]).catch("grid").parse(get("ansicht")),
  };
}

export function parseEscortFilters(input: Input): EscortFilters {
  const get = getter(input);
  const lists = Object.fromEntries(Object.entries(ESCORT_LISTS).map(([k, allowed]) => [k, listOf(get(k), allowed)])) as Record<EscortListKey, string[]>;
  const ranges = Object.fromEntries((Object.keys(RANGES) as RangeKey[]).map((k) => [k, rangeOf(get(k), k)])) as Record<RangeKey, Range>;
  const flags = Object.fromEntries(ESCORT_FLAGS.map((k) => [k, flag.parse(get(k))])) as Record<EscortFlag, boolean>;
  return {
    ...baseOf(get),
    typ: "escort",
    ort: z.enum(["incall", "outcall"]).nullable().catch(null).parse(get("ort") ?? null),
    bewertung: z.coerce.number().int().min(1).max(5).nullable().catch(null).parse(get("bewertung") ?? null),
    ...ranges,
    ...lists,
    ...flags,
  };
}

export function parseClubFilters(input: Input): ClubFilters {
  const get = getter(input);
  const extra: ClubExtra = { bool: [], multi: {}, min: {} };
  for (const k of keysOf(input)) {
    const m = /^x([bmn])\.(.+)$/.exec(k);
    if (!m || !KEY_RE.test(m[2]!)) continue;
    const key = m[2]!;
    const v = get(k);
    if (m[1] === "b" && (v === "1" || v === "true")) extra.bool.push(key);
    if (m[1] === "m") {
      const l = listOf(v, undefined, 20);
      if (l.length) extra.multi[key] = l;
    }
    if (m[1] === "n") {
      const n = optNumber(0, 100000).parse(v);
      if (n != null) extra.min[key] = n;
    }
  }
  return {
    ...baseOf(get),
    typ: "club",
    clubtyp: listOf(get("clubtyp"), values(CLUB_TYPES)),
    offen: flag.parse(get("offen")),
    eintritt: optNumber(0, 1000).parse(get("eintritt") ?? null),
    wellness: listOf(get("wellness"), WELLNESS),
    extra,
  };
}

export function parseFilters(input: Input): SearchFilters {
  return getter(input)("typ") === "club" ? parseClubFilters(input) : parseEscortFilters(input);
}

/** Filter → URL-Parameter (Standardwerte werden weggelassen). */
export function toSearchParams(f: SearchFilters, opts: { keepPage?: boolean } = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (f.typ === "club") p.set("typ", "club");
  if (f.stadt) p.set("stadt", f.stadt);
  else if (f.lat != null && f.lng != null) {
    p.set("lat", f.lat.toFixed(2));
    p.set("lng", f.lng.toFixed(2));
  }
  if (f.radius !== RADIUS.default) p.set("radius", String(f.radius));
  if (f.typ === "escort") {
    for (const k of Object.keys(RANGES) as RangeKey[]) {
      const r = f[k];
      if (r) p.set(k, `${r[0]}-${r[1]}`);
    }
    for (const k of Object.keys(ESCORT_LISTS) as EscortListKey[]) if (f[k].length) p.set(k, f[k].join(","));
    if (f.ort) p.set("ort", f.ort);
    if (f.bewertung) p.set("bewertung", String(f.bewertung));
    for (const k of ESCORT_FLAGS) if (f[k]) p.set(k, "1");
  } else {
    if (f.clubtyp.length) p.set("clubtyp", f.clubtyp.join(","));
    if (f.offen) p.set("offen", "1");
    if (f.eintritt != null) p.set("eintritt", String(f.eintritt));
    if (f.wellness.length) p.set("wellness", f.wellness.join(","));
    for (const k of f.extra.bool) p.set(`xb.${k}`, "1");
    for (const [k, v] of Object.entries(f.extra.multi)) if (v.length) p.set(`xm.${k}`, v.join(","));
    for (const [k, v] of Object.entries(f.extra.min)) p.set(`xn.${k}`, String(v));
  }
  if (f.sort !== "distanz") p.set("sort", f.sort);
  if (f.ansicht !== "grid") p.set("ansicht", f.ansicht);
  if (opts.keepPage && f.seite > 1) p.set("seite", String(f.seite));
  return p;
}

/** Für gespeicherte Suchen (JSONB): ohne Ansicht und Seite. */
export function toQueryRecord(f: SearchFilters): Record<string, string> {
  const p = toSearchParams({ ...f, ansicht: "grid", seite: 1 });
  return Object.fromEntries(p.entries());
}

export function searchHref(f: SearchFilters, opts: { keepPage?: boolean } = {}) {
  const qs = toSearchParams(f, opts).toString().replace(/%2C/g, ",");
  return qs ? `/suche?${qs}` : "/suche";
}

/** Ausgangspunkt für Distanz und Umkreis: eigener Standort oder Stadtzentrum. */
export function originOf(f: Pick<Base, "stadt" | "lat" | "lng">): { lat: number; lng: number } | null {
  if (f.lat != null && f.lng != null) return { lat: f.lat, lng: f.lng };
  if (f.stadt) {
    const c = findCity(f.stadt);
    if (c) return { lat: c.lat, lng: c.lng };
  }
  return null;
}

/** Anzahl aktiver Filter (ohne Standort, Sortierung, Ansicht). */
export function activeFilterCount(f: SearchFilters) {
  if (f.typ === "escort") {
    let n = 0;
    for (const k of Object.keys(RANGES) as RangeKey[]) if (f[k]) n++;
    for (const k of Object.keys(ESCORT_LISTS) as EscortListKey[]) if (f[k].length) n++;
    for (const k of ESCORT_FLAGS) if (f[k]) n++;
    if (f.ort) n++;
    if (f.bewertung) n++;
    return n;
  }
  return (
    (f.clubtyp.length ? 1 : 0) +
    (f.offen ? 1 : 0) +
    (f.eintritt != null ? 1 : 0) +
    (f.wellness.length ? 1 : 0) +
    f.extra.bool.length +
    Object.keys(f.extra.multi).length +
    Object.keys(f.extra.min).length
  );
}

/** Filter zurücksetzen, Standort und Typ behalten. */
export function resetFilters(f: SearchFilters): SearchFilters {
  const keep = new URLSearchParams();
  if (f.typ === "club") keep.set("typ", "club");
  if (f.stadt) keep.set("stadt", f.stadt);
  if (f.lat != null && f.lng != null) {
    keep.set("lat", String(f.lat));
    keep.set("lng", String(f.lng));
  }
  keep.set("radius", String(f.radius));
  keep.set("sort", f.sort);
  keep.set("ansicht", f.ansicht);
  return parseFilters(keep);
}

export const CITY_NAMES = CITIES.map((c) => c.name);
