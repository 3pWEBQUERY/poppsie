import type { ClubFieldDef, ClubFieldRule } from "@/db/schema";

/**
 * Standard-Felddefinitionen je Club-Typ (Kapitel 4). Werden beim Start in club_type_schemas
 * angelegt, falls noch nicht vorhanden; danach sind sie in der Datenbank editierbar.
 * Name, Logo, Cover, Beschreibung, Adresse, Karte und Öffnungszeiten sind feste Spalten.
 */
type Row = [key: string, label: string, input: ClubFieldDef["input"], rules: ClubFieldRule[], options?: string[]];

const R = "required" as const;
const O = "optional" as const;
const H = "hidden" as const;
// Reihenfolge der Regeln: club, studio, laufhaus, kontaktbar, saunaclub, nachtclub
const ROWS: Row[] = [
  ["entryPrice", "Eintrittspreis (CHF)", "money", [R, H, H, O, R, R]],
  ["roomRates", "Zimmerpreise / Tarife", "list", [R, R, R, R, R, O]],
  ["roomCount", "Anzahl Zimmer", "number", [O, R, R, H, R, H]],
  ["wellness", "Wellness", "multiselect", [O, H, H, H, R, H], ["Sauna", "Pool", "Whirlpool", "Dampfbad", "Ruhebereich"]],
  ["bar", "Bar / Getränkekarte", "textarea", [R, H, H, R, R, R]],
  ["shows", "Shows / Events", "textarea", [O, H, H, O, O, R]],
  ["dresscode", "Dresscode", "text", [O, H, H, O, H, R]],
  ["parking", "Parkplätze", "boolean", [R, R, R, R, R, R]],
  ["discreetEntrance", "Diskreter Eingang", "boolean", [R, R, R, R, R, R]],
  ["payment", "Zahlungsarten", "multiselect", [R, R, R, R, R, R], ["Bar", "EC/Debit", "Kreditkarte", "TWINT", "Krypto"]],
];

const TYPES = ["club", "studio", "laufhaus", "kontaktbar", "saunaclub", "nachtclub"] as const;
const LABELS: Record<(typeof TYPES)[number], string> = {
  club: "Club",
  studio: "Studio",
  laufhaus: "Laufhaus",
  kontaktbar: "Kontaktbar",
  saunaclub: "Saunaclub",
  nachtclub: "Nachtclub",
};

export const DEFAULT_CLUB_SCHEMAS = TYPES.map((type, i) => ({
  clubType: type,
  label: LABELS[type],
  fields: ROWS.map(([key, label, input, rules, options]) => ({ key, label, input, rule: rules[i]!, options })).filter((f) => f.rule !== "hidden"),
}));
