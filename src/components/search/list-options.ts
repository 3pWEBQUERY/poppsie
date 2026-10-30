/** Optionen der Mehrfach-Filter (Suche und Präferenzen). */
import type { SelectOption } from "@/components/shared/select/select";
import {
  BREAST_TYPES,
  CLOTHING_SIZES,
  CLOTHING_STYLES,
  CUP_SIZES,
  EYE_COLORS,
  GENDERS,
  HAIR_COLORS,
  INTIMATE,
  PIERCINGS,
  SHOE_SIZES,
  TATTOOS,
} from "@/lib/profile/fields";
import type { EscortListKey } from "@/lib/search/filters";
import { languageSelectOptions, nationalityOptions, SERVICE_OPTIONS } from "./options";

export const LIST_LABELS: Record<EscortListKey, string> = {
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
};

export function listOptions(key: EscortListKey): { options: SelectOption[]; searchable?: boolean } {
  switch (key) {
    case "geschlecht":
      return { options: GENDERS };
    case "nat":
      return { options: nationalityOptions(), searchable: true };
    case "sprachen":
      return { options: languageSelectOptions(), searchable: true };
    case "cup":
      return { options: CUP_SIZES };
    case "brust":
      return { options: BREAST_TYPES };
    case "intim":
      return { options: INTIMATE };
    case "piercings":
      return { options: PIERCINGS };
    case "tattoos":
      return { options: TATTOOS };
    case "stil":
      return { options: CLOTHING_STYLES };
    case "kleidung":
      return { options: CLOTHING_SIZES };
    case "schuhe":
      return { options: SHOE_SIZES };
    case "haare":
      return { options: HAIR_COLORS };
    case "augen":
      return { options: EYE_COLORS };
    case "services":
      return { options: SERVICE_OPTIONS, searchable: true };
  }
}
