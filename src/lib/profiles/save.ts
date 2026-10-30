import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, clubTypeSchemas, escortProfiles, media, profileLanguages, users, type ClubFieldDef, type OpeningHours } from "@/db/schema";
import { ApiError } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { CITIES } from "@/lib/geo/cities";
import { deleteMediaRows, ownProfileMedia } from "./media";
import { profileStatus } from "./draft";
import { schemaFor, toFieldErrors } from "./schemas";
import type { StepKey } from "./steps";
import type { SaveResult } from "./types";

type EscortPatch = Partial<typeof escortProfiles.$inferInsert>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = Record<string, any>;

async function upsertEscort(userId: string, patch: EscortPatch) {
  await db
    .insert(escortProfiles)
    .values({ userId, ...patch })
    .onConflictDoUpdate({ target: escortProfiles.userId, set: { ...patch, updatedAt: new Date() } });
}

async function updateUser(userId: string, patch: Partial<typeof users.$inferInsert>) {
  if (Object.keys(patch).length === 0) return;
  await db.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, userId));
}

async function updateClub(userId: string, patch: Partial<typeof clubProfiles.$inferInsert>) {
  const res = await db
    .update(clubProfiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clubProfiles.userId, userId))
    .returning({ id: clubProfiles.userId });
  if (!res.length) throw new ApiError("NOT_FOUND", "Club-Profil nicht gefunden");
}

const cityOf = (name: string | null | undefined) => (name ? (CITIES.find((c) => c.name === name) ?? null) : null);

/** Speichert einen Schritt als Entwurf (Teildaten erlaubt) und berechnet den Profilstatus neu. */
export async function saveStep(user: SessionUser, step: StepKey, raw: unknown): Promise<SaveResult> {
  let clubFields: ClubFieldDef[] = [];
  if (user.accountType === "club") {
    const [c] = await db.select({ type: clubProfiles.clubType }).from(clubProfiles).where(eq(clubProfiles.userId, user.id));
    if (!c) throw new ApiError("NOT_FOUND", "Club-Profil nicht gefunden");
    const [schema] = await db.select().from(clubTypeSchemas).where(eq(clubTypeSchemas.clubType, c.type));
    clubFields = schema?.fields ?? [];
  }
  const schema = schemaFor(user.accountType, step, clubFields);
  if (!schema) throw new ApiError("INVALID", "Unbekannter Schritt");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { saved: false, errors: toFieldErrors(parsed.error), status: null };
  const d = parsed.data as Data;

  if (step === "media") await saveMedia(user, d);
  else if (user.accountType === "member") await updateUser(user.id, { country: d.country ?? null, region: d.region ?? null, bio: d.bio ?? null });
  else if (user.accountType === "escort") await saveEscort(user, step, d);
  else await saveClub(user, step, d);

  return { saved: true, errors: {}, status: await profileStatus(user.id) };
}

async function saveEscort(user: SessionUser, step: StepKey, d: Data) {
  switch (step) {
    case "basics": {
      const [current] = await db.select({ birthDate: escortProfiles.birthDate }).from(escortProfiles).where(eq(escortProfiles.userId, user.id));
      const locked = user.kycStatus === "verified" && Boolean(current?.birthDate);
      await upsertEscort(user.id, {
        displayName: d.displayName ?? null,
        gender: d.gender ?? null,
        slogan: d.slogan ?? null,
        ...(locked ? {} : { birthDate: d.birthDate ?? null }),
      });
      await updateUser(user.id, { country: d.country ?? null });
      return;
    }
    case "appearance": {
      await upsertEscort(user.id, {
        heightCm: d.heightCm ?? null,
        weightKg: d.weightKg ?? null,
        nationality: d.nationality ?? null,
        cupSize: d.cupSize ?? null,
        breastType: d.breastType ?? null,
        intimate: d.intimate ?? null,
        piercings: d.piercings ?? [],
        tattoos: d.tattoos ?? null,
        clothingStyles: d.clothingStyles ?? [],
        clothingSize: d.clothingSize ?? null,
        shoeSize: d.shoeSize ? Number(d.shoeSize) : null,
        hairColor: d.hairColor ?? null,
        eyeColor: d.eyeColor ?? null,
      });
      const langs = (d.languages ?? []) as { value: string; level: number }[];
      const unique = [...new Map(langs.map((l) => [l.value, l])).values()];
      await db.transaction(async (tx) => {
        await tx.delete(profileLanguages).where(eq(profileLanguages.userId, user.id));
        if (unique.length) await tx.insert(profileLanguages).values(unique.map((l) => ({ userId: user.id, languageCode: l.value, level: l.level })));
      });
      return;
    }
    case "location": {
      const city = cityOf(d.city);
      await upsertEscort(user.id, {
        city: city?.name ?? null,
        country: city?.country ?? "CH",
        lat: city?.lat ?? null,
        lng: city?.lng ?? null,
        radiusKm: d.radiusKm ?? 10,
      });
      if (city && !user.country) await updateUser(user.id, { country: city.country });
      return;
    }
    case "about":
      await upsertEscort(user.id, { about: d.about ?? null });
      // Kurzvorstellung für Karten/Vorschauen
      await updateUser(user.id, { bio: d.about ? String(d.about).slice(0, 2000) : null });
      return;
    case "services": {
      const prices = ((d.prices ?? []) as { minutes: number; price: number }[]).sort((a, b) => a.minutes - b.minutes);
      await upsertEscort(user.id, {
        services: d.services ?? [],
        prices,
        workplace: d.workplace ?? null,
        connectEnabled: d.connectEnabled,
        connectRule: d.connectRule,
      });
      return;
    }
    default:
      throw new ApiError("INVALID", "Unbekannter Schritt");
  }
}

async function saveClub(user: SessionUser, step: StepKey, d: Data) {
  switch (step) {
    case "basics":
      await updateClub(user.id, { name: d.name ?? null });
      await updateUser(user.id, { country: d.country ?? null });
      return;
    case "about":
      await updateClub(user.id, { description: d.description ?? null });
      await updateUser(user.id, { bio: d.description ? String(d.description).slice(0, 2000) : null });
      return;
    case "location": {
      const city = cityOf(d.city);
      await updateClub(user.id, {
        street: d.street ?? null,
        postalCode: d.postalCode ?? null,
        city: city?.name ?? null,
        country: city?.country ?? "CH",
        lat: city?.lat ?? null,
        lng: city?.lng ?? null,
      });
      if (city && !user.country) await updateUser(user.id, { country: city.country });
      return;
    }
    case "hours": {
      const hours: Partial<OpeningHours> = {};
      for (const [k, ranges] of Object.entries((d.openingHours ?? {}) as Record<string, { from: string; to: string }[] | undefined>)) {
        if (ranges?.length) hours[k as keyof OpeningHours] = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
      }
      await updateClub(user.id, { openingHours: hours });
      return;
    }
    case "details": {
      const [c] = await db.select({ data: clubProfiles.data }).from(clubProfiles).where(eq(clubProfiles.userId, user.id));
      const next: Record<string, unknown> = { ...(c?.data ?? {}) };
      for (const [k, v] of Object.entries((d.data ?? {}) as Record<string, unknown>)) {
        const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) delete next[k];
        else next[k] = v;
      }
      await updateClub(user.id, { data: next });
      return;
    }
    default:
      throw new ApiError("INVALID", "Unbekannter Schritt");
  }
}

async function saveMedia(user: SessionUser, d: Data) {
  const [u] = await db.select({ avatar: users.avatarMediaId, cover: users.coverMediaId }).from(users).where(eq(users.id, user.id));
  const wanted = [d.avatarId, d.coverId, ...((d.gallery ?? []) as { id: string }[]).map((g) => g.id)].filter(Boolean) as string[];
  const own = await ownProfileMedia(user.id, wanted);
  const owns = (id: string) => own.some((m) => m.id === id);
  const replaced: string[] = [];
  const patch: Partial<typeof users.$inferInsert> = {};

  for (const [field, col, current] of [
    ["avatarId", "avatarMediaId", u?.avatar],
    ["coverId", "coverMediaId", u?.cover],
  ] as const) {
    const next = d[field] as string | null | undefined;
    if (next === undefined || next === current) continue;
    if (next && !owns(next)) throw new ApiError("FORBIDDEN", "Medium gehört nicht dir");
    patch[col] = next;
    if (current) replaced.push(current);
  }
  await updateUser(user.id, patch);
  if (user.accountType === "club" && "avatarMediaId" in patch) await updateClub(user.id, { logoMediaId: patch.avatarMediaId ?? null });

  const gallery = (d.gallery ?? []) as { id: string; blur: boolean }[];
  for (const [i, g] of gallery.entries()) {
    if (!owns(g.id)) continue;
    await db
      .update(media)
      .set({ sortOrder: i, blurForGuests: g.blur })
      .where(and(eq(media.id, g.id), eq(media.ownerId, user.id)));
  }

  if (typeof d.blurForGuests === "boolean") {
    if (user.accountType === "escort") await upsertEscort(user.id, { blurForGuests: d.blurForGuests });
    if (user.accountType === "club") await updateClub(user.id, { blurForGuests: d.blurForGuests });
  }

  // Ersetzte Einzelbilder (Avatar/Cover-Uploads) aufräumen; Galeriebilder bleiben erhalten.
  if (replaced.length) {
    const old = await db
      .select({ id: media.id, purpose: media.purpose })
      .from(media)
      .where(and(eq(media.ownerId, user.id), inArray(media.id, replaced)));
    await deleteMediaRows(
      user.id,
      old.filter((m) => m.purpose !== "gallery" && !wanted.includes(m.id)).map((m) => m.id),
    );
  }
}
