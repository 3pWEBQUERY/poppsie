import { z } from "zod";
import type { ClubFieldDef } from "@/db/schema";
import { ALL_COUNTRIES } from "@/lib/geo/countries";
import { CITIES } from "@/lib/geo/cities";
import { LANGUAGE_CODES } from "@/lib/geo/languages";
import {
  ALL_SERVICES,
  BREAST_TYPES,
  CLOTHING_SIZES,
  CLOTHING_STYLES,
  CUP_SIZES,
  DURATIONS,
  EYE_COLORS,
  GENDERS,
  HAIR_COLORS,
  INTIMATE,
  PIERCINGS,
  SHOE_SIZES,
  TATTOOS,
  WORKPLACES,
  ageFrom,
} from "@/lib/profile/fields";
import type { StepKey } from "./steps";

/**
 * Validierung der Profil-Schritte (Client und Server). Alle Felder sind optional, damit Entwürfe
 * gespeichert werden können; Pflichtfelder bestimmt completeness.ts.
 */
type Opt = { value: string; label: string };
const values = (list: Opt[]) => list.map((o) => o.value) as [string, ...string[]];
const oneOf = (list: Opt[]) => z.enum(values(list), { error: "Bitte wähle einen gültigen Wert" }).nullable().optional();
const manyOf = (list: Opt[], max = 50) => z.array(z.enum(values(list), { error: "Ungültige Auswahl" })).max(max, `Höchstens ${max} Einträge`);
const text = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen`)
    .refine((v) => v.length === 0 || v.length >= min, `Mindestens ${min} Zeichen`)
    .transform((v) => (v.length ? v : null))
    .nullable()
    .optional();
const intRange = (min: number, max: number, unit = "") =>
  z
    .number({ error: "Bitte gib eine Zahl ein" })
    .int("Bitte gib eine ganze Zahl ein")
    .min(min, `Mindestens ${min}${unit}`)
    .max(max, `Höchstens ${max}${unit}`)
    .nullable()
    .optional();

const country = z
  .string()
  .refine((c) => ALL_COUNTRIES.includes(c), "Bitte wähle ein Land")
  .nullable()
  .optional();
const cityName = z
  .string()
  .refine((c) => CITIES.some((x) => x.name === c), "Bitte wähle eine Stadt aus der Liste")
  .nullable()
  .optional();

export const memberBasicsSchema = z.object({
  country,
  region: text(60),
  bio: text(2000),
});

export const escortBasicsSchema = z.object({
  displayName: text(40, 2),
  gender: oneOf(GENDERS),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte gib ein gültiges Datum ein")
    .refine((d) => {
      const age = ageFrom(d);
      return age !== null && age >= 18 && age <= 99;
    }, "Du musst mindestens 18 Jahre alt sein")
    .nullable()
    .optional(),
  slogan: text(120),
  country,
});

export const languageSchema = z.object({
  value: z.enum(LANGUAGE_CODES as unknown as [string, ...string[]], { error: "Unbekannte Sprache" }),
  level: z.number().int().min(1).max(5),
});

export const escortAppearanceSchema = z.object({
  heightCm: intRange(140, 210, " cm"),
  weightKg: intRange(40, 150, " kg"),
  nationality: country,
  languages: z.array(languageSchema).max(20, "Höchstens 20 Sprachen"),
  cupSize: oneOf(CUP_SIZES),
  breastType: oneOf(BREAST_TYPES),
  intimate: oneOf(INTIMATE),
  piercings: manyOf(PIERCINGS),
  tattoos: oneOf(TATTOOS),
  clothingStyles: manyOf(CLOTHING_STYLES),
  clothingSize: oneOf(CLOTHING_SIZES),
  shoeSize: oneOf(SHOE_SIZES),
  hairColor: oneOf(HAIR_COLORS),
  eyeColor: oneOf(EYE_COLORS),
});

export const escortLocationSchema = z.object({
  city: cityName,
  radiusKm: z.number({ error: "Bitte gib eine Zahl ein" }).int().min(0, "Mindestens 0 km").max(300, "Höchstens 300 km"),
});

export const escortAboutSchema = z.object({ about: text(5000, 50) });
export const clubAboutSchema = z.object({ description: text(5000, 50) });

export const priceSchema = z.object({
  minutes: z.number().int().refine((m) => DURATIONS.some((d) => Number(d.value) === m), "Ungültige Dauer"),
  price: z.number({ error: "Bitte gib einen Preis ein" }).int("Bitte ganze Franken").min(1, "Preis fehlt").max(100000, "Preis zu hoch"),
});

export const escortServicesSchema = z.object({
  services: manyOf(ALL_SERVICES, 60),
  prices: z
    .array(priceSchema)
    .max(DURATIONS.length)
    .refine((p) => new Set(p.map((x) => x.minutes)).size === p.length, "Jede Dauer nur einmal"),
  workplace: oneOf(WORKPLACES),
  connectEnabled: z.boolean(),
  connectRule: z.enum(["all", "verified", "with_review", "followers"]),
});

export const clubBasicsSchema = z.object({ name: text(80, 2), country });

export const clubLocationSchema = z.object({
  street: text(120, 3),
  postalCode: z
    .string()
    .trim()
    .regex(/^(\d{4,5})?$/, "Bitte gib eine gültige Postleitzahl ein")
    .transform((v) => v || null)
    .nullable()
    .optional(),
  city: cityName,
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM");
const range = z.object({ from: time, to: time }).refine((r) => r.from !== r.to, "Beginn und Ende sind gleich");
const day = z.array(range).max(4, "Höchstens 4 Zeitfenster").optional();
export const openingHoursSchema = z.object({ mo: day, di: day, mi: day, do: day, fr: day, sa: day, so: day });
export const clubHoursSchema = z.object({ openingHours: openingHoursSchema });

/** Dynamische Club-Felder nach club_type_schemas. */
export function clubDetailsSchema(fields: ClubFieldDef[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    if (f.rule === "hidden") continue;
    let s: z.ZodType;
    switch (f.input) {
      case "number":
        s = z.number({ error: "Bitte gib eine Zahl ein" }).int("Bitte gib eine ganze Zahl ein").min(0).max(100000);
        break;
      case "money":
        s = z.number({ error: "Bitte gib einen Betrag ein" }).min(0, "Betrag ungültig").max(100000, "Betrag zu hoch");
        break;
      case "boolean":
        s = z.boolean();
        break;
      case "multiselect":
        s = z.array(f.options?.length ? z.enum(f.options as [string, ...string[]], { error: "Ungültige Auswahl" }) : z.string().max(60)).max(30);
        break;
      case "list":
        s = z.array(z.string().trim().min(1, "Eintrag ist leer").max(120, "Höchstens 120 Zeichen")).max(30, "Höchstens 30 Einträge");
        break;
      case "textarea":
        s = z.string().trim().max(3000, "Höchstens 3000 Zeichen");
        break;
      default:
        s = z.string().trim().max(200, "Höchstens 200 Zeichen");
    }
    shape[f.key] = s.nullable().optional();
  }
  return z.object({ data: z.object(shape) });
}

export const mediaStepSchema = z.object({
  avatarId: z.uuid().nullable().optional(),
  coverId: z.uuid().nullable().optional(),
  gallery: z.array(z.object({ id: z.uuid(), blur: z.boolean() })).max(50, "Höchstens 50 Medien"),
  blurForGuests: z.boolean().optional(),
});

export type FieldErrors = Record<string, string>;

export function toFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Schema für einen Schritt (ohne club details, die brauchen die Felddefinitionen). */
export function schemaFor(accountType: "member" | "escort" | "club", step: StepKey, clubFields: ClubFieldDef[] = []): z.ZodType | null {
  if (step === "media") return mediaStepSchema;
  if (accountType === "member") return step === "basics" ? memberBasicsSchema : null;
  if (accountType === "escort") {
    const map: Partial<Record<StepKey, z.ZodType>> = {
      basics: escortBasicsSchema,
      appearance: escortAppearanceSchema,
      location: escortLocationSchema,
      about: escortAboutSchema,
      services: escortServicesSchema,
    };
    return map[step] ?? null;
  }
  const map: Partial<Record<StepKey, z.ZodType>> = {
    basics: clubBasicsSchema,
    about: clubAboutSchema,
    location: clubLocationSchema,
    hours: clubHoursSchema,
    details: clubDetailsSchema(clubFields),
  };
  return map[step] ?? null;
}

export type MemberBasics = z.input<typeof memberBasicsSchema>;
export type EscortBasics = z.input<typeof escortBasicsSchema>;
export type EscortAppearance = z.input<typeof escortAppearanceSchema>;
export type EscortLocation = z.input<typeof escortLocationSchema>;
export type EscortServices = z.input<typeof escortServicesSchema>;
export type ClubLocation = z.input<typeof clubLocationSchema>;
export type OpeningHoursInput = z.input<typeof openingHoursSchema>;
