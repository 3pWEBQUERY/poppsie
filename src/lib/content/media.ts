import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { media, postMedia } from "@/db/schema";
import { ApiError } from "@/lib/auth/guards";
import { mediaUrl } from "@/lib/media/urls";
import type { MediaView } from "./types";

type MediaRow = Pick<typeof media.$inferSelect, "id" | "kind" | "blurForGuests" | "width" | "height" | "thumbKey" | "blurKey">;

/**
 * Medien-URL passend zum Betrachter. Gäste erhalten bei Blur (pro Medium oder in Forum-Kategorien
 * mit Erwachsenen-Medien) nur die unkenntliche Variante; Videos werden Gästen dann gar nicht ausgeliefert.
 */
export function mediaView(m: MediaRow, opts: { guest: boolean; adultOnly?: boolean }): MediaView {
  const locked = opts.guest && (m.blurForGuests || Boolean(opts.adultOnly));
  if (m.kind === "video") {
    if (locked) return { id: m.id, kind: "video", thumbUrl: null, url: null, width: m.width, height: m.height, locked: true };
    return { id: m.id, kind: "video", thumbUrl: m.thumbKey ? mediaUrl(m.id, "t") : null, url: mediaUrl(m.id, "o"), width: m.width, height: m.height };
  }
  if (locked) {
    const b = m.blurKey ? mediaUrl(m.id, "b") : null;
    return { id: m.id, kind: "image", thumbUrl: b, url: b, width: m.width, height: m.height, locked: true };
  }
  return { id: m.id, kind: "image", thumbUrl: mediaUrl(m.id, "t"), url: mediaUrl(m.id, "o"), width: m.width, height: m.height };
}

/** Medien mehrerer Posts in Reihenfolge laden. */
export async function mediaForPosts(postIds: string[]) {
  const map = new Map<string, MediaRow[]>();
  if (!postIds.length) return map;
  const rows = await db
    .select({
      postId: postMedia.postId,
      id: media.id,
      kind: media.kind,
      blurForGuests: media.blurForGuests,
      width: media.width,
      height: media.height,
      thumbKey: media.thumbKey,
      blurKey: media.blurKey,
      status: media.status,
    })
    .from(postMedia)
    .innerJoin(media, eq(media.id, postMedia.mediaId))
    .where(inArray(postMedia.postId, postIds))
    .orderBy(asc(postMedia.sortOrder));
  for (const r of rows) {
    if (r.status === "rejected" || (r.kind !== "image" && r.kind !== "video")) continue;
    const list = map.get(r.postId) ?? [];
    list.push(r);
    map.set(r.postId, list);
  }
  return map;
}

export async function mediaByIds(ids: string[]) {
  const map = new Map<string, MediaRow>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return map;
  const rows = await db
    .select({ id: media.id, kind: media.kind, blurForGuests: media.blurForGuests, width: media.width, height: media.height, thumbKey: media.thumbKey, blurKey: media.blurKey })
    .from(media)
    .where(inArray(media.id, unique));
  for (const r of rows) map.set(r.id, r);
  return map;
}

/** Prüft, dass alle Medien dem Benutzer gehören und für Beiträge hochgeladen wurden. */
export async function assertOwnMedia(userId: string, ids: string[], purposes: (typeof media.$inferSelect)["purpose"][]) {
  if (!ids.length) return;
  const rows = await db
    .select({ id: media.id, purpose: media.purpose, kind: media.kind, status: media.status })
    .from(media)
    .where(and(inArray(media.id, ids), eq(media.ownerId, userId)));
  const ok = rows.filter((r) => purposes.includes(r.purpose) && r.status !== "rejected" && (r.kind === "image" || r.kind === "video"));
  if (ok.length !== new Set(ids).size) throw new ApiError("INVALID", "Ungültige Medien");
}
