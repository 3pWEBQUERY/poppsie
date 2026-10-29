/** ISO 639-1 (alle 183 Codes). Namen über Intl.DisplayNames. */
export const LANGUAGE_CODES = [
  "aa", "ab", "ae", "af", "ak", "am", "an", "ar", "as", "av", "ay", "az", "ba", "be", "bg", "bi", "bm", "bn", "bo", "br", "bs", "ca",
  "ce", "ch", "co", "cr", "cs", "cu", "cv", "cy", "da", "de", "dv", "dz", "ee", "el", "en", "eo", "es", "et", "eu", "fa", "ff", "fi",
  "fj", "fo", "fr", "fy", "ga", "gd", "gl", "gn", "gu", "gv", "ha", "he", "hi", "ho", "hr", "ht", "hu", "hy", "hz", "ia", "id", "ie",
  "ig", "ii", "ik", "io", "is", "it", "iu", "ja", "jv", "ka", "kg", "ki", "kj", "kk", "kl", "km", "kn", "ko", "kr", "ks", "ku", "kv",
  "kw", "ky", "la", "lb", "lg", "li", "ln", "lo", "lt", "lu", "lv", "mg", "mh", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "na",
  "nb", "nd", "ne", "ng", "nl", "nn", "no", "nr", "nv", "ny", "oc", "oj", "om", "or", "os", "pa", "pi", "pl", "ps", "pt", "qu", "rm",
  "rn", "ro", "ru", "rw", "sa", "sc", "sd", "se", "sg", "si", "sk", "sl", "sm", "sn", "so", "sq", "sr", "ss", "st", "su", "sv", "sw",
  "ta", "te", "tg", "th", "ti", "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ty", "ug", "uk", "ur", "uz", "ve", "vi", "vo", "wa",
  "wo", "xh", "yi", "yo", "za", "zh", "zu",
] as const;

const cache = new Map<string, Intl.DisplayNames>();

export function languageName(code: string, locale = "de") {
  let dn = cache.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([locale], { type: "language" });
    cache.set(locale, dn);
  }
  try {
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export function languageOptions(locale = "de") {
  const top = ["de", "fr", "it", "en", "es", "pt", "ru", "ro", "hu", "pl"];
  const rest = LANGUAGE_CODES.filter((c) => !top.includes(c)).sort((a, b) => languageName(a, locale).localeCompare(languageName(b, locale), locale));
  return [...top, ...rest].map((code) => ({ value: code, label: languageName(code, locale) }));
}
