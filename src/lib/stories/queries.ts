import "server-only";
import { and, asc, count, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, reactions, stories, storyComments, storyViews, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { reactionSummaries, toAuthor } from "@/lib/content/hydrate";
import { mediaUrl } from "@/lib/media/urls";
import { getSummaries } from "@/lib/users/summary";
import { visibleToSql } from "@/lib/visibility";
import type { HighlightGroup, ManagedStory, Sticker, StoryAuthorEntry, StoryView } from "./types";

/**
 * Autorinnen mit aktiven Stories für die Story-Leiste: eigene zuerst, dann Gefolgte/Favoriten
 * (Ungesehene vor Gesehenen), dann alle anderen nach Aktualität. Sichtbarkeitsregeln gelten.
 */
export async function storyBar(viewer: SessionUser | null, countries: string[], limit = 40): Promise<StoryAuthorEntry[]> {
  const vid = viewer?.id ?? null;
  const rows = await db
    .select({
      authorId: stories.authorId,
      n: count(),
      latest: sql<Date>`max(${stories.createdAt})`.mapWith((v) => new Date(v)),
      unseen: vid
        ? sql<number>`count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM story_views sv WHERE sv.story_id = ${stories.id} AND sv.viewer_id = ${vid}))`.mapWith(Number)
        : sql<number>`count(*)`.mapWith(Number),
      close: vid
        ? sql<number>`max(CASE WHEN EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${vid} AND f.followee_id = ${stories.authorId})
            OR EXISTS (SELECT 1 FROM favorites fv WHERE fv.user_id = ${vid} AND fv.target_id = ${stories.authorId}) THEN 1 ELSE 0 END)`.mapWith(Number)
        : sql<number>`0`.mapWith(Number),
    })
    .from(stories)
    .where(and(gt(stories.expiresAt, new Date()), vid ? or(eq(stories.authorId, vid), visibleToSql(stories.authorId, vid, countries)) : visibleToSql(stories.authorId, null, countries)))
    .groupBy(stories.authorId)
    .limit(200);
  const sorted = rows.sort((a, b) => {
    const own = Number(b.authorId === vid) - Number(a.authorId === vid);
    if (own) return own;
    if (b.close !== a.close) return b.close - a.close;
    const seen = Number(b.unseen > 0) - Number(a.unseen > 0);
    if (seen) return seen;
    return b.latest.getTime() - a.latest.getTime();
  });
  const top = sorted.slice(0, limit);
  const sums = await getSummaries(
    top.map((r) => r.authorId),
    viewer,
  );
  return top
    .filter((r) => sums.has(r.authorId))
    .map((r) => ({ author: toAuthor(sums.get(r.authorId)), count: r.n, latestAt: r.latest.toISOString(), seen: r.unseen === 0, own: r.authorId === vid }));
}

type StoryRow = typeof stories.$inferSelect & { kind: string; durationSec: number | null; thumbKey: string | null };

async function toViews(rows: StoryRow[], viewer: SessionUser): Promise<StoryView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [reacts, commentCounts, seen, authors] = await Promise.all([
    reactionSummaries("story", ids, viewer.id),
    db.select({ id: storyComments.storyId, n: count() }).from(storyComments).where(inArray(storyComments.storyId, ids)).groupBy(storyComments.storyId),
    db.select({ id: storyViews.storyId }).from(storyViews).where(and(inArray(storyViews.storyId, ids), eq(storyViews.viewerId, viewer.id))),
    db.select({ id: users.id, username: users.username, type: users.accountType }).from(users).where(inArray(users.id, [...new Set(rows.map((r) => r.authorId))])),
  ]);
  const seenSet = new Set(seen.map((s) => s.id));
  return rows.map((r) => {
    const a = authors.find((x) => x.id === r.authorId);
    return {
      id: r.id,
      authorId: r.authorId,
      kind: r.kind === "video" ? "video" : "image",
      url: mediaUrl(r.mediaId, "o"),
      thumbUrl: r.thumbKey ? mediaUrl(r.mediaId, "t") : null,
      durationSec: r.durationSec,
      overlayText: r.overlayText,
      stickers: (r.stickers ?? []) as Sticker[],
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      highlight: r.highlight,
      highlightTitle: r.highlightTitle,
      reactions: reacts.get(r.id)!,
      commentCount: commentCounts.find((c) => c.id === r.id)?.n ?? 0,
      bookHref: a?.type === "escort" ? `/escort/${a.username}/buchen` : null,
      seen: seenSet.has(r.id),
    };
  });
}

const storyCols = {
  id: stories.id,
  authorId: stories.authorId,
  mediaId: stories.mediaId,
  overlayText: stories.overlayText,
  stickers: stories.stickers,
  highlight: stories.highlight,
  highlightTitle: stories.highlightTitle,
  expiresAt: stories.expiresAt,
  createdAt: stories.createdAt,
  kind: media.kind,
  durationSec: media.durationSec,
  thumbKey: media.thumbKey,
};

/** Aktive Stories oder Highlights (optional nur ein Titel) einer Autorin für eingeloggte Betrachter. */
export async function authorStories(authorId: string, viewer: SessionUser, countries: string[], mode: { highlights?: boolean; title?: string | null; ids?: string[] } = {}) {
  const own = viewer.id === authorId;
  const rows = await db
    .select(storyCols)
    .from(stories)
    .innerJoin(media, eq(media.id, stories.mediaId))
    .where(
      and(
        eq(stories.authorId, authorId),
        own ? undefined : visibleToSql(stories.authorId, viewer.id, countries),
        mode.ids?.length ? inArray(stories.id, mode.ids) : undefined,
        mode.highlights ? eq(stories.highlight, true) : gt(stories.expiresAt, new Date()),
        mode.highlights && mode.title !== undefined ? (mode.title === null ? sql`${stories.highlightTitle} IS NULL` : eq(stories.highlightTitle, mode.title)) : undefined,
      ),
    )
    .orderBy(asc(stories.createdAt))
    .limit(50);
  return toViews(rows as StoryRow[], viewer);
}

/** Highlights gruppiert nach Titel (für die Highlight-Reihe auf dem Profil). */
export async function highlightGroups(authorId: string, viewer: SessionUser | null, countries: string[]): Promise<HighlightGroup[]> {
  const rows = await db
    .select({ id: stories.id, title: stories.highlightTitle, mediaId: stories.mediaId, kind: media.kind, blur: media.blurForGuests, createdAt: stories.createdAt })
    .from(stories)
    .innerJoin(media, eq(media.id, stories.mediaId))
    .where(and(eq(stories.authorId, authorId), eq(stories.highlight, true), viewer?.id === authorId ? undefined : visibleToSql(stories.authorId, viewer?.id ?? null, countries)))
    .orderBy(desc(stories.createdAt))
    .limit(100);
  const groups = new Map<string, HighlightGroup>();
  for (const r of rows) {
    const title = r.title?.trim() || "Highlights";
    const g = groups.get(title) ?? { key: title, title, coverUrl: null, storyIds: [] };
    g.storyIds.push(r.id);
    if (!g.coverUrl && r.kind === "image") g.coverUrl = mediaUrl(r.mediaId, !viewer && r.blur ? "b" : "t");
    groups.set(title, g);
  }
  return [...groups.values()];
}

/** Eigene Stories fürs Dashboard (aktiv, abgelaufen, Highlights) mit Kennzahlen. */
export async function managedStories(userId: string): Promise<ManagedStory[]> {
  const rows = await db
    .select(storyCols)
    .from(stories)
    .innerJoin(media, eq(media.id, stories.mediaId))
    .where(eq(stories.authorId, userId))
    .orderBy(desc(stories.createdAt))
    .limit(200);
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const [views, likes, comments] = await Promise.all([
    db.select({ id: storyViews.storyId, n: count() }).from(storyViews).where(inArray(storyViews.storyId, ids)).groupBy(storyViews.storyId),
    db
      .select({ id: reactions.targetId, n: count() })
      .from(reactions)
      .where(and(eq(reactions.targetType, "story"), inArray(reactions.targetId, ids)))
      .groupBy(reactions.targetId),
    db.select({ id: storyComments.storyId, n: count() }).from(storyComments).where(inArray(storyComments.storyId, ids)).groupBy(storyComments.storyId),
  ]);
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === "video" ? "video" : "image",
    thumbUrl: r.kind === "image" ? mediaUrl(r.mediaId, "t") : r.thumbKey ? mediaUrl(r.mediaId, "t") : null,
    url: mediaUrl(r.mediaId, "o"),
    overlayText: r.overlayText,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    active: r.expiresAt.getTime() > now,
    highlight: r.highlight,
    highlightTitle: r.highlightTitle,
    views: views.find((v) => v.id === r.id)?.n ?? 0,
    likes: likes.find((v) => v.id === r.id)?.n ?? 0,
    comments: comments.find((v) => v.id === r.id)?.n ?? 0,
  }));
}
