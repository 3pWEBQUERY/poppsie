/** Wizard-/Editor-Schritte je Kontotyp. Die Schlüssel entsprechen den `step`-Werten aus completeness.ts. */
export type AccountType = "member" | "escort" | "club";
export type StepKey = "basics" | "appearance" | "location" | "about" | "services" | "media" | "hours" | "details";

export type StepDef = { key: StepKey; label: string; description: string };

export const STEPS: Record<AccountType, StepDef[]> = {
  member: [
    { key: "basics", label: "Über dich", description: "Land, Kanton und ein paar Worte über dich." },
    { key: "media", label: "Profilbild", description: "Optional: Profilbild und Titelbild." },
  ],
  escort: [
    { key: "basics", label: "Basisdaten", description: "Name, Geschlecht, Geburtsdatum und Slogan." },
    { key: "appearance", label: "Aussehen & Sprachen", description: "Diese Angaben helfen Mitgliedern, dich zu finden." },
    { key: "location", label: "Standort", description: "Nur Stadt und Umkreis – nie deine genaue Adresse." },
    { key: "about", label: "Über mich", description: "Beschreibe dich und dein Angebot in eigenen Worten." },
    { key: "services", label: "Services & Preise", description: "Was du anbietest, zu welchen Preisen und wo." },
    { key: "media", label: "Fotos", description: "Profilbild und Galerie (mindestens 3 Fotos)." },
  ],
  club: [
    { key: "basics", label: "Betrieb", description: "Name und Land deines Betriebs." },
    { key: "about", label: "Beschreibung", description: "Stelle deinen Betrieb vor." },
    { key: "location", label: "Adresse", description: "Adresse für Karte und Suche." },
    { key: "hours", label: "Öffnungszeiten", description: "Pro Wochentag, auch mehrere Zeitfenster." },
    { key: "details", label: "Angebot & Details", description: "Felder passend zu deinem Betriebstyp." },
    { key: "media", label: "Logo & Bilder", description: "Logo, Titelbild und Galerie." },
  ],
};

export function stepsFor(type: AccountType) {
  return STEPS[type];
}
