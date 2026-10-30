import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import type { ProfileCardData } from "@/components/shared/profile-card";
import { roundedPosition } from "@/lib/geo/cities";
import { mediaUrl, variantFor } from "@/lib/media/urls";
import { ageFrom, CLUB_TYPES, labelOf } from "@/lib/profile/fields";
import { profileHref } from "@/lib/users/summary";
import type { ClubRow } from "./clubs";
import type { EscortRow } from "./escorts";
import { isOpenNow } from "./time";

const NEW_MS = 14 * 86400_000;

export type MapPoint = { id: string; lat: number; lng: number; card: ProfileCardData };

type Viewer = { id: string } | null;

function image(id: string | null, blurForGuests: boolean, viewer: Viewer) {
  return id ? mediaUrl(id, variantFor({ blurForGuests, isGuest: !viewer, wanted: "t" })) : null;
}

const withSrc = (href: string, src: string) => `${href}?src=${src}`;

export function escortCard(r: EscortRow, viewer: Viewer, src = "search"): ProfileCardData {
  return {
    id: r.id,
    href: withSrc(profileHref({ username: r.username, accountType: "escort" }), src),
    name: r.displayName || r.username,
    accountType: "escort",
    imageUrl: image(r.avatarMediaId, r.blurForGuests, viewer),
    age: ageFrom(r.birthDate),
    city: r.city,
    distanceKm: r.distanceKm,
    ratingAvg: r.ratingAvg,
    ratingCount: r.ratingCount,
    verified: true,
    hasStory: r.hasStory,
    availableToday: r.availableToday,
    isNew: Date.now() - r.createdAt.getTime() < NEW_MS,
  };
}

export function clubCard(r: ClubRow, viewer: Viewer, src = "search"): ProfileCardData {
  const open = isOpenNow(r.openingHours);
  const parts = [labelOf(CLUB_TYPES, r.clubType), open ? "Jetzt geöffnet" : null, r.lineupCount ? `${r.lineupCount} Girls` : null];
  return {
    id: r.id,
    href: withSrc(profileHref({ username: r.username, accountType: "club", clubSlug: r.slug }), src),
    name: r.name || r.username,
    accountType: "club",
    imageUrl: image(r.imageMediaId, r.blurForGuests, viewer),
    subtitle: parts.filter(Boolean).join(" · "),
    city: r.city,
    distanceKm: r.distanceKm,
    ratingAvg: r.ratingAvg,
    ratingCount: r.ratingCount,
    verified: true,
    hasStory: r.hasStory,
    isNew: Date.now() - r.createdAt.getTime() < NEW_MS,
  };
}

/** Favoriten-Status für eingeloggte Betrachter ergänzen. */
export async function withFavorites(cards: ProfileCardData[], viewer: Viewer) {
  if (!viewer || cards.length === 0) return cards;
  const rows = await db
    .select({ id: favorites.targetId })
    .from(favorites)
    .where(and(eq(favorites.userId, viewer.id), inArray(favorites.targetId, cards.map((c) => c.id))));
  const set = new Set(rows.map((r) => r.id));
  return cards.map((c) => ({ ...c, isFavorite: set.has(c.id) }));
}

/** Kartenpunkte: Positionen immer gerundet (~1 km), nie exakt. */
export function mapPoints(rows: { id: string; lat: number | null; lng: number | null }[], cards: ProfileCardData[]): MapPoint[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out: MapPoint[] = [];
  for (const r of rows) {
    const card = byId.get(r.id);
    if (r.lat == null || r.lng == null || !card) continue;
    out.push({ id: r.id, ...roundedPosition(r.lat, r.lng), card });
  }
  return out;
}
