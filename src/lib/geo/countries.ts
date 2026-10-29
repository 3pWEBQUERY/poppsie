/** ISO 3166-1 alpha-2, gruppiert nach Kontinent. Namen liefert Intl.DisplayNames in der UI-Sprache. */
export const CONTINENTS = {
  europe: [
    "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GG", "GI", "GR",
    "HR", "HU", "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS",
    "RU", "SE", "SI", "SJ", "SK", "SM", "UA", "VA", "XK",
  ],
  asia: [
    "AE", "AF", "AM", "AZ", "BD", "BH", "BN", "BT", "CN", "GE", "HK", "ID", "IL", "IN", "IQ", "IR", "JO", "JP", "KG", "KH", "KP", "KR",
    "KW", "KZ", "LA", "LB", "LK", "MM", "MN", "MO", "MV", "MY", "NP", "OM", "PH", "PK", "PS", "QA", "SA", "SG", "SY", "TH", "TJ", "TL",
    "TM", "TR", "TW", "UZ", "VN", "YE",
  ],
  africa: [
    "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ",
    "GW", "KE", "KM", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA", "NE", "NG", "RE", "RW", "SC", "SD", "SH", "SL",
    "SN", "SO", "SS", "ST", "SZ", "TD", "TG", "TN", "TZ", "UG", "YT", "ZA", "ZM", "ZW",
  ],
  northAmerica: [
    "AG", "AI", "AW", "BB", "BL", "BM", "BQ", "BS", "BZ", "CA", "CR", "CU", "CW", "DM", "DO", "GD", "GL", "GP", "GT", "HN", "HT", "JM",
    "KN", "KY", "LC", "MF", "MQ", "MS", "MX", "NI", "PA", "PM", "PR", "SV", "SX", "TC", "TT", "US", "VC", "VG", "VI",
  ],
  southAmerica: ["AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR", "UY", "VE"],
  oceania: [
    "AS", "AU", "CK", "FJ", "FM", "GU", "KI", "MH", "MP", "NC", "NF", "NR", "NU", "NZ", "PF", "PG", "PN", "PW", "SB", "TK", "TO", "TV",
    "UM", "VU", "WF", "WS",
  ],
} as const;

export type ContinentKey = keyof typeof CONTINENTS;

export const CONTINENT_LABELS: Record<ContinentKey, string> = {
  europe: "Europa",
  asia: "Asien",
  africa: "Afrika",
  northAmerica: "Nordamerika",
  southAmerica: "Südamerika",
  oceania: "Ozeanien",
};

export const ALL_COUNTRIES: string[] = Object.values(CONTINENTS).flat();

export function continentOf(code: string): ContinentKey | null {
  for (const [k, list] of Object.entries(CONTINENTS)) if ((list as readonly string[]).includes(code)) return k as ContinentKey;
  return null;
}

const nameCache = new Map<string, Intl.DisplayNames>();

export function countryName(code: string, locale = "de") {
  let dn = nameCache.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([locale], { type: "region" });
    nameCache.set(locale, dn);
  }
  try {
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Länderliste sortiert nach Namen, Schweiz und Nachbarn zuerst. */
export function countryOptions(locale = "de") {
  const top = ["CH", "DE", "AT", "FR", "IT", "LI"];
  const rest = ALL_COUNTRIES.filter((c) => !top.includes(c)).sort((a, b) => countryName(a, locale).localeCompare(countryName(b, locale), locale));
  return [...top, ...rest].map((code) => ({ value: code, label: countryName(code, locale) }));
}

export const SWISS_CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR",
  "VD", "VS", "ZG", "ZH",
] as const;

export const CANTON_NAMES: Record<(typeof SWISS_CANTONS)[number], string> = {
  AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden", BE: "Bern", BL: "Basel-Landschaft", BS: "Basel-Stadt",
  FR: "Freiburg", GE: "Genf", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Luzern", NE: "Neuenburg", NW: "Nidwalden",
  OW: "Obwalden", SG: "St. Gallen", SH: "Schaffhausen", SO: "Solothurn", SZ: "Schwyz", TG: "Thurgau", TI: "Tessin", UR: "Uri",
  VD: "Waadt", VS: "Wallis", ZG: "Zug", ZH: "Zürich",
};
