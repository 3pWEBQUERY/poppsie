import "server-only";
import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clubProfiles, escortProfiles, media, users } from "@/db/schema";
import { encrypt } from "@/lib/auth/crypto";
import { mediaUrl, variantFor } from "@/lib/media/urls";

export type UserSummary = {
  id: string;
  username: string;
  name: string;
  accountType: "member" | "escort" | "club";
  avatarUrl: string | null;
  verified: boolean;
  href: string;
  online?: boolean;
};

export type AnonymousSummary = { anonymous: true; name: string; avatarUrl: string | null };

export function profileHref(u: { username: string; accountType: string; clubSlug?: string | null }) {
  if (u.accountType === "escort") return `/escort/${u.username}`;
  if (u.accountType === "club") return `/club/${u.clubSlug ?? u.username}`;
  return `/u/${u.username}`;
}

const avatarMedia = alias(media, "avatar_media");

/** Kompakte Profildaten inkl. Avatar-URL passend zum Betrachter (Gäste sehen Blur-Varianten). */
export async function getSummaries(ids: string[], viewer: { id: string } | null): Promise<Map<string, UserSummary>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, UserSummary>();
  if (unique.length === 0) return map;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      accountType: users.accountType,
      kycStatus: users.kycStatus,
      showOnline: users.showOnline,
      lastSeenAt: users.lastSeenAt,
      avatarId: users.avatarMediaId,
      avatarBlur: avatarMedia.blurForGuests,
      escortName: escortProfiles.displayName,
      clubName: clubProfiles.name,
      clubSlug: clubProfiles.slug,
    })
    .from(users)
    .leftJoin(avatarMedia, eq(avatarMedia.id, users.avatarMediaId))
    .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .leftJoin(clubProfiles, eq(clubProfiles.userId, users.id))
    .where(inArray(users.id, unique));
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      username: r.username,
      name: r.escortName || r.clubName || r.username,
      accountType: r.accountType,
      avatarUrl: r.avatarId ? mediaUrl(r.avatarId, variantFor({ blurForGuests: Boolean(r.avatarBlur), isGuest: !viewer, wanted: "t" })) : null,
      verified: r.kycStatus === "verified",
      href: profileHref({ username: r.username, accountType: r.accountType, clubSlug: r.clubSlug }),
      online: r.showOnline && r.lastSeenAt ? Date.now() - r.lastSeenAt.getTime() < 5 * 60_000 : false,
    });
  }
  return map;
}

export async function getSummary(id: string, viewer: { id: string } | null) {
  return (await getSummaries([id], viewer)).get(id) ?? null;
}

/**
 * Inkognito-Besucher: Milchglas-Avatar über ein undurchsichtiges, verschlüsseltes Token
 * (kein Rückschluss auf User- oder Medien-ID), kein Link, kein Name.
 */
export function anonymousSummary(avatarMediaId: string | null): AnonymousSummary {
  if (!avatarMediaId) return { anonymous: true, name: "Anonymes Mitglied", avatarUrl: null };
  const token = encrypt(JSON.stringify({ m: avatarMediaId, e: Math.floor(Date.now() / 1000) + 3600 }));
  return { anonymous: true, name: "Anonymes Mitglied", avatarUrl: `/api/frosted/${token}` };
}
