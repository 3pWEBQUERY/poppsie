import type { clubProfiles, escortProfiles, users } from "@/db/schema";

type User = typeof users.$inferSelect;
type Escort = typeof escortProfiles.$inferSelect | null | undefined;
type Club = typeof clubProfiles.$inferSelect | null | undefined;

export type Check = { key: string; label: string; done: boolean; required: boolean; step: string };

/** Pflichtfelder definieren profile_complete, optionale Felder erhöhen nur den Profil-Score. */
export function profileChecks(user: User, ctx: { escort?: Escort; club?: Club; languages?: number; galleryCount?: number; requiredClubKeys?: string[] }): Check[] {
  const base: Check[] = [
    { key: "avatar", label: "Profilbild", done: Boolean(user.avatarMediaId), required: user.accountType !== "member", step: "media" },
    { key: "country", label: "Land", done: Boolean(user.country), required: true, step: "basics" },
    { key: "bio", label: "Über mich", done: Boolean(user.bio && user.bio.length >= 20), required: false, step: "basics" },
  ];
  if (user.accountType === "member") {
    return [...base, { key: "region", label: "Kanton / Region", done: Boolean(user.region), required: true, step: "basics" }];
  }
  if (user.accountType === "escort") {
    const e = ctx.escort;
    return [
      ...base,
      { key: "displayName", label: "Anzeigename", done: Boolean(e?.displayName), required: true, step: "basics" },
      { key: "gender", label: "Geschlecht", done: Boolean(e?.gender), required: true, step: "basics" },
      { key: "birthDate", label: "Geburtsdatum", done: Boolean(e?.birthDate), required: true, step: "basics" },
      { key: "city", label: "Standort", done: Boolean(e?.city && e?.lat), required: true, step: "location" },
      { key: "about", label: "Beschreibung", done: Boolean(e?.about && e.about.length >= 50), required: true, step: "about" },
      { key: "languages", label: "Sprachen", done: (ctx.languages ?? 0) > 0, required: true, step: "appearance" },
      { key: "height", label: "Grösse", done: Boolean(e?.heightCm), required: false, step: "appearance" },
      { key: "weight", label: "Gewicht", done: Boolean(e?.weightKg), required: false, step: "appearance" },
      { key: "nationality", label: "Nationalität", done: Boolean(e?.nationality), required: false, step: "appearance" },
      { key: "hair", label: "Haarfarbe", done: Boolean(e?.hairColor), required: false, step: "appearance" },
      { key: "services", label: "Services", done: (e?.services.length ?? 0) > 0, required: true, step: "services" },
      { key: "prices", label: "Preise", done: (e?.prices.length ?? 0) > 0, required: true, step: "services" },
      { key: "workplace", label: "Arbeitsort", done: Boolean(e?.workplace), required: true, step: "services" },
      { key: "gallery", label: "Mindestens 3 Fotos", done: (ctx.galleryCount ?? 0) >= 3, required: true, step: "media" },
    ];
  }
  const c = ctx.club;
  const data = (c?.data ?? {}) as Record<string, unknown>;
  return [
    ...base.map((b) => (b.key === "avatar" ? { ...b, label: "Logo / Profilbild" } : b)),
    { key: "name", label: "Name des Betriebs", done: Boolean(c?.name), required: true, step: "basics" },
    { key: "description", label: "Beschreibung", done: Boolean(c?.description && c.description.length >= 50), required: true, step: "about" },
    { key: "address", label: "Adresse", done: Boolean(c?.street && c?.city && c?.lat), required: true, step: "location" },
    { key: "hours", label: "Öffnungszeiten", done: Object.keys(c?.openingHours ?? {}).length > 0, required: true, step: "hours" },
    ...(ctx.requiredClubKeys ?? []).map((k) => ({
      key: `data.${k}`,
      label: k,
      done: data[k] !== undefined && data[k] !== null && data[k] !== "" && !(Array.isArray(data[k]) && (data[k] as unknown[]).length === 0),
      required: true,
      step: "details",
    })),
    { key: "gallery", label: "Mindestens 3 Fotos", done: (ctx.galleryCount ?? 0) >= 3, required: false, step: "media" },
  ];
}

export function summarize(checks: Check[]) {
  const required = checks.filter((c) => c.required);
  const complete = required.every((c) => c.done);
  const percent = Math.round((checks.filter((c) => c.done).length / Math.max(checks.length, 1)) * 100);
  const nextStep = checks.find((c) => c.required && !c.done)?.step ?? checks.find((c) => !c.done)?.step ?? null;
  return { complete, percent, nextStep };
}
