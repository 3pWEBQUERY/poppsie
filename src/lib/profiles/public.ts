import "server-only";
import { cache } from "react";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { favorites, follows, media, reviews, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { mediaUrl, variantFor } from "@/lib/media/urls";

export type PublicMedia = { id: string; kind: "image" | "video"; thumb: string; full: string | null; blurred: boolean; width: number | null; height: number | null };

export const findUser = cache(async (username: string) => {
  const [u] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
  return u ?? null;
});

/** Medien-URL passend zum Betrachter: Gäste erhalten bei Blur ausschliesslich die Blur-Variante. */
export function viewerUrl(m: { id: string; blurForGuests: boolean; kind: string }, viewer: SessionUser | null, wanted: "t" | "o") {
  if (m.kind !== "image") return mediaUrl(m.id, "o");
  return mediaUrl(m.id, variantFor({ blurForGuests: m.blurForGuests, isGuest: !viewer, wanted }));
}

export async function singleMedia(id: string | null | undefined, viewer: SessionUser | null, wanted: "t" | "o" = "o") {
  if (!id) return null;
  const [m] = await db.select().from(media).where(eq(media.id, id));
  if (!m || m.status === "rejected") return null;
  return viewerUrl(m, viewer, wanted);
}

/**
 * Öffentliche Galerie. Für Gäste sind unkenntlich gemachte Bilder nur als Blur-Variante enthalten;
 * unkenntlich gemachte Videos werden Gästen gar nicht ausgeliefert (es gibt keine Blur-Variante).
 */
export async function publicGallery(ownerId: string, viewer: SessionUser | null): Promise<PublicMedia[]> {
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.ownerId, ownerId), eq(media.purpose, "gallery"), eq(media.status, "ready"), inArray(media.kind, ["image", "video"])))
    .orderBy(asc(media.sortOrder), asc(media.createdAt));
  return rows.map((m) => {
    const guestBlur = !viewer && m.blurForGuests;
    if (m.kind === "video") {
      return { id: m.id, kind: "video" as const, thumb: "", full: guestBlur ? null : mediaUrl(m.id, "o"), blurred: guestBlur, width: m.width, height: m.height };
    }
    return {
      id: m.id,
      kind: "image" as const,
      thumb: viewerUrl(m, viewer, "t"),
      full: viewerUrl(m, viewer, "o"),
      blurred: guestBlur,
      width: m.width,
      height: m.height,
    };
  });
}

export async function relationTo(viewer: SessionUser | null, targetId: string) {
  if (!viewer || viewer.id === targetId) return { favorite: false, following: false };
  const [fav] = await db
    .select({ x: favorites.targetId })
    .from(favorites)
    .where(and(eq(favorites.userId, viewer.id), eq(favorites.targetId, targetId)));
  const [fol] = await db
    .select({ x: follows.followeeId })
    .from(follows)
    .where(and(eq(follows.followerId, viewer.id), eq(follows.followeeId, targetId)));
  return { favorite: Boolean(fav), following: Boolean(fol) };
}

export async function followerCount(userId: string) {
  const [r] = await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, userId));
  return r?.n ?? 0;
}

export async function reviewsWritten(userId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(reviews)
    .where(and(eq(reviews.authorId, userId), eq(reviews.hidden, false)));
  return r?.n ?? 0;
}

/**
 * Connect-Regel für den Button "Nachricht schreiben". Die verbindliche Prüfung macht der Messenger;
 * hier geht es um die Anzeige.
 */
export async function connectState(
  escort: { userId: string; connectEnabled: boolean; connectRule: "all" | "verified" | "with_review" | "followers" },
  viewer: SessionUser | null,
): Promise<{ allowed: boolean; reason: string | null }> {
  if (!escort.connectEnabled) return { allowed: false, reason: "Kontakt nur über Buchung" };
  if (!viewer || viewer.accountType !== "member") return { allowed: true, reason: null };
  switch (escort.connectRule) {
    case "verified":
      return viewer.kycStatus === "verified" || viewer.badges.includes("verified") ? { allowed: true, reason: null } : { allowed: false, reason: "Nur für verifizierte Mitglieder" };
    case "with_review":
      return (await reviewsWritten(viewer.id)) > 0 ? { allowed: true, reason: null } : { allowed: false, reason: "Nur für Mitglieder mit mind. 1 Bericht" };
    case "followers": {
      const r = await relationTo(viewer, escort.userId);
      return r.following ? { allowed: true, reason: null } : { allowed: false, reason: "Nur für Follower – folge zuerst" };
    }
    default:
      return { allowed: true, reason: null };
  }
}
