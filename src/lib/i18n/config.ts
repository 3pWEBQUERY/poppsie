export const LOCALES = ["de", "fr", "it", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "pp_locale";
export const LOCALE_LABELS: Record<Locale, string> = { de: "Deutsch", fr: "Français", it: "Italiano", en: "English" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
