/** Teilbewertungen je Profiltyp (rein, auch im Client nutzbar). */
export type Criterion = { key: string; label: string };

export const ESCORT_CRITERIA: Criterion[] = [
  { key: "photos", label: "Aussehen wie Fotos" },
  { key: "service", label: "Service" },
  { key: "friendliness", label: "Freundlichkeit" },
  { key: "punctuality", label: "Pünktlichkeit" },
];

export const CLUB_CRITERIA: Criterion[] = [
  { key: "cleanliness", label: "Sauberkeit" },
  { key: "ambience", label: "Ambiente" },
  { key: "value", label: "Preis-Leistung" },
  { key: "service", label: "Service" },
];

export function criteriaFor(type: "escort" | "club") {
  return type === "club" ? CLUB_CRITERIA : ESCORT_CRITERIA;
}

export const REVIEW_INTERVAL_DAYS = 30;

export const REVIEW_DURATIONS = [
  { value: "30", label: "30 min" },
  { value: "60", label: "1 Stunde" },
  { value: "90", label: "1,5 Stunden" },
  { value: "120", label: "2 Stunden" },
  { value: "180", label: "3 Stunden" },
  { value: "720", label: "Nacht" },
];

export function reviewDurationLabel(min: number | null | undefined) {
  if (!min) return null;
  return REVIEW_DURATIONS.find((d) => Number(d.value) === min)?.label ?? `${min} min`;
}

export type ReviewSort = "neueste" | "beste" | "schlechteste";
export const REVIEW_SORTS: { value: ReviewSort; label: string }[] = [
  { value: "neueste", label: "Neueste" },
  { value: "beste", label: "Beste" },
  { value: "schlechteste", label: "Schlechteste" },
];
