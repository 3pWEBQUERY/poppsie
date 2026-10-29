import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, clubTypeSchemas, escortProfiles, media, profileLanguages, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media/urls";
import { recomputeProfile } from "@/lib/profile/recompute";
import type { MediaItem, MediaValues, ProfileDraft, ProfileStatus } from "./types";

type MediaRow = typeof media.$inferSelect;

export function toMediaItem(m: Pick<MediaRow, "id" | "kind" | "fileName" | "blurForGuests">): MediaItem {
  return {
    id: m.id,
    kind: m.kind,
    thumbUrl: mediaUrl(m.id, m.kind === "image" ? "t" : "o"),
    url: mediaUrl(m.id, "o"),
    fileName: m.fileName,
    blurForGuests: m.blurForGuests,
  };
}

/** Galerie, Avatar und Cover des Users (Sicht des Eigentümers). */
export async function loadOwnMedia(userId: string): Promise<MediaValues> {
  const [u] = await db.select({ avatar: users.avatarMediaId, cover: users.coverMediaId, type: users.accountType }).from(users).where(eq(users.id, userId));
  const gallery = await db
    .select()
    .from(media)
    .where(and(eq(media.ownerId, userId), eq(media.purpose, "gallery")))
    .orderBy(asc(media.sortOrder), asc(media.createdAt));
  const ids = [u?.avatar, u?.cover].filter(Boolean) as string[];
  const singles = ids.length ? await db.select().from(media).where(and(eq(media.ownerId, userId), inArray(media.id, ids))) : [];
  const find = (id: string | null | undefined) => {
    const m = id ? singles.find((x) => x.id === id) : undefined;
    return m ? toMediaItem(m) : null;
  };
  let blurForGuests = false;
  if (u?.type === "escort") {
    const [e] = await db.select({ b: escortProfiles.blurForGuests }).from(escortProfiles).where(eq(escortProfiles.userId, userId));
    blurForGuests = e?.b ?? true;
  } else if (u?.type === "club") {
    const [c] = await db.select({ b: clubProfiles.blurForGuests }).from(clubProfiles).where(eq(clubProfiles.userId, userId));
    blurForGuests = c?.b ?? false;
  }
  return { avatar: find(u?.avatar), cover: find(u?.cover), gallery: gallery.map(toMediaItem), blurForGuests };
}

export async function profileStatus(userId: string): Promise<ProfileStatus> {
  const s = await recomputeProfile(userId);
  return { percent: s?.percent ?? 0, complete: s?.complete ?? false, nextStep: s?.nextStep ?? null, checks: s?.checks ?? [] };
}

/** Aktueller Stand aller Schritte für Wizard und Profil-Editor. */
export async function loadDraft(user: SessionUser): Promise<ProfileDraft> {
  const [fresh] = await db.select().from(users).where(eq(users.id, user.id));
  const u = fresh ?? user;
  const mediaValues = await loadOwnMedia(u.id);
  const status = await profileStatus(u.id);
  const base: ProfileDraft = {
    accountType: u.accountType,
    username: u.username,
    kycStatus: u.kycStatus,
    clubType: null,
    clubTypeLabel: null,
    clubFields: [],
    values: { media: mediaValues as unknown as Record<string, unknown> },
    status,
  };

  if (u.accountType === "member") {
    base.values.basics = { country: u.country, region: u.region, bio: u.bio };
    return base;
  }

  if (u.accountType === "escort") {
    const [e] = await db.select().from(escortProfiles).where(eq(escortProfiles.userId, u.id));
    const langs = await db.select().from(profileLanguages).where(eq(profileLanguages.userId, u.id));
    base.values.basics = { displayName: e?.displayName ?? null, gender: e?.gender ?? null, birthDate: e?.birthDate ?? null, slogan: e?.slogan ?? null, country: u.country };
    base.values.appearance = {
      heightCm: e?.heightCm ?? null,
      weightKg: e?.weightKg ?? null,
      nationality: e?.nationality ?? null,
      languages: langs.map((l) => ({ value: l.languageCode, level: l.level })),
      cupSize: e?.cupSize ?? null,
      breastType: e?.breastType ?? null,
      intimate: e?.intimate ?? null,
      piercings: e?.piercings ?? [],
      tattoos: e?.tattoos ?? null,
      clothingStyles: e?.clothingStyles ?? [],
      clothingSize: e?.clothingSize ?? null,
      shoeSize: e?.shoeSize ? String(e.shoeSize) : null,
      hairColor: e?.hairColor ?? null,
      eyeColor: e?.eyeColor ?? null,
    };
    base.values.location = { city: e?.city ?? null, radiusKm: e?.radiusKm ?? 10 };
    base.values.about = { about: e?.about ?? null };
    base.values.services = {
      services: e?.services ?? [],
      prices: e?.prices?.map((p) => ({ minutes: p.minutes, price: p.price })) ?? [],
      workplace: e?.workplace ?? null,
      connectEnabled: e?.connectEnabled ?? true,
      connectRule: e?.connectRule ?? "all",
    };
    return base;
  }

  const [c] = await db.select().from(clubProfiles).where(eq(clubProfiles.userId, u.id));
  if (c) {
    const [schema] = await db.select().from(clubTypeSchemas).where(eq(clubTypeSchemas.clubType, c.clubType));
    base.clubType = c.clubType;
    base.clubTypeLabel = schema?.label ?? c.clubType;
    base.clubFields = (schema?.fields ?? []).filter((f) => f.rule !== "hidden");
  }
  base.values.basics = { name: c?.name ?? null, country: u.country ?? "CH" };
  base.values.about = { description: c?.description ?? null };
  base.values.location = { street: c?.street ?? null, postalCode: c?.postalCode ?? null, city: c?.city ?? null };
  base.values.hours = { openingHours: c?.openingHours ?? {} };
  base.values.details = { data: c?.data ?? {} };
  return base;
}
