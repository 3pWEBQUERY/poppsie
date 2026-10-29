/** Optionslisten für Escort-Felder (Kapitel 4), auch für Suche und Präferenzen genutzt. */
type Opt = { value: string; label: string };

export const GENDERS: Opt[] = [
  { value: "frau", label: "Frau" },
  { value: "trans", label: "Trans" },
  { value: "mann", label: "Mann" },
  { value: "divers", label: "Divers" },
];

export const CUP_SIZES: Opt[] = ["AA", "A", "B", "C", "D", "E", "F", "G", "H"].map((v) => ({ value: v, label: v }));

export const BREAST_TYPES: Opt[] = [
  { value: "natuerlich", label: "Natürlich" },
  { value: "operiert", label: "Operiert" },
];

export const INTIMATE: Opt[] = [
  { value: "rasiert", label: "Rasiert" },
  { value: "teilrasiert", label: "Teilrasiert" },
  { value: "natuerlich", label: "Natürlich" },
];

export const PIERCINGS: Opt[] = [
  { value: "keine", label: "Keine" },
  { value: "ohren", label: "Ohren" },
  { value: "nase", label: "Nase" },
  { value: "zunge", label: "Zunge" },
  { value: "bauchnabel", label: "Bauchnabel" },
  { value: "brust", label: "Brust" },
  { value: "intim", label: "Intim" },
  { value: "andere", label: "Andere" },
];

export const TATTOOS: Opt[] = [
  { value: "keine", label: "Keine" },
  { value: "wenige", label: "Wenige" },
  { value: "viele", label: "Viele" },
];

export const CLOTHING_STYLES: Opt[] = [
  { value: "elegant", label: "Elegant" },
  { value: "sportlich", label: "Sportlich" },
  { value: "casual", label: "Casual" },
  { value: "sexy", label: "Sexy" },
  { value: "business", label: "Business" },
  { value: "fetisch", label: "Fetisch" },
];

export const CLOTHING_SIZES: Opt[] = ["XS", "S", "M", "L", "XL", "XXL", "32", "34", "36", "38", "40", "42", "44", "46", "48"].map((v) => ({
  value: v,
  label: /^\d+$/.test(v) ? `EU ${v}` : v,
}));

export const SHOE_SIZES: Opt[] = Array.from({ length: 11 }, (_, i) => String(34 + i)).map((v) => ({ value: v, label: `EU ${v}` }));

export const HAIR_COLORS: Opt[] = ["blond", "brünett", "schwarz", "rot", "grau", "bunt", "glatze"].map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

export const EYE_COLORS: Opt[] = ["blau", "grün", "braun", "grau", "haselnuss"].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

export const WORKPLACES: Opt[] = [
  { value: "incall", label: "Incall (bei mir)" },
  { value: "outcall", label: "Outcall (Haus-/Hotelbesuch)" },
  { value: "both", label: "Beides" },
];

/** Kuratierte Service-Liste, gruppiert. */
export const SERVICE_GROUPS: { group: string; items: Opt[] }[] = [
  {
    group: "Begleitung",
    items: [
      { value: "abendbegleitung", label: "Abendbegleitung" },
      { value: "reisebegleitung", label: "Reisebegleitung" },
      { value: "dinner_date", label: "Dinner-Date" },
      { value: "geschaeftsbegleitung", label: "Geschäftsbegleitung" },
      { value: "overnight", label: "Übernachtung" },
      { value: "gfe", label: "Girlfriend-Experience" },
    ],
  },
  {
    group: "Softcore",
    items: [
      { value: "kuesse", label: "Küssen" },
      { value: "kuscheln", label: "Kuscheln" },
      { value: "massage", label: "Erotische Massage" },
      { value: "tantra", label: "Tantra" },
      { value: "striptease", label: "Striptease" },
      { value: "duschen", label: "Gemeinsames Duschen" },
      { value: "handentspannung", label: "Handentspannung" },
      { value: "rollenspiele", label: "Rollenspiele" },
    ],
  },
  {
    group: "Fetisch & BDSM",
    items: [
      { value: "dominant", label: "Dominant" },
      { value: "devot", label: "Devot" },
      { value: "fussfetisch", label: "Fussfetisch" },
      { value: "lack_leder", label: "Lack & Leder" },
      { value: "nylons", label: "Nylons" },
      { value: "fesseln", label: "Fesselspiele" },
    ],
  },
  {
    group: "Für Paare",
    items: [
      { value: "paare", label: "Für Paare" },
      { value: "duo", label: "Duo mit Freundin" },
      { value: "frauen", label: "Auch für Frauen" },
    ],
  },
];

export const ALL_SERVICES: Opt[] = SERVICE_GROUPS.flatMap((g) => g.items);

export const DURATIONS: Opt[] = [
  { value: "30", label: "30 Minuten" },
  { value: "60", label: "1 Stunde" },
  { value: "90", label: "1,5 Stunden" },
  { value: "120", label: "2 Stunden" },
  { value: "180", label: "3 Stunden" },
  { value: "720", label: "Nacht" },
];

export const CLUB_TYPES: Opt[] = [
  { value: "club", label: "Club" },
  { value: "studio", label: "Studio" },
  { value: "laufhaus", label: "Laufhaus" },
  { value: "kontaktbar", label: "Kontaktbar" },
  { value: "saunaclub", label: "Saunaclub" },
  { value: "nachtclub", label: "Nachtclub" },
];

export function labelOf(list: Opt[], value: string | null | undefined) {
  return list.find((o) => o.value === value)?.label ?? value ?? "";
}

export const WEEKDAYS = [
  { key: "mo", label: "Montag", short: "Mo" },
  { key: "di", label: "Dienstag", short: "Di" },
  { key: "mi", label: "Mittwoch", short: "Mi" },
  { key: "do", label: "Donnerstag", short: "Do" },
  { key: "fr", label: "Freitag", short: "Fr" },
  { key: "sa", label: "Samstag", short: "Sa" },
  { key: "so", label: "Sonntag", short: "So" },
] as const;

/** Alter aus Geburtsdatum. */
export function ageFrom(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}
