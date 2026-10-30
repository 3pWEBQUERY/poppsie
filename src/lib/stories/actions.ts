"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parse } from "@/lib/content/validate";
import { db } from "@/db";
import { media, reactions, stories, storyComments, storyViews, users } from "@/db/schema";
import { track } from "@/lib/analytics";
import { ApiError, isStaff, requireUser, run } from "@/lib/auth/guards";
import { toAuthor } from "@/lib/content/hydrate";
import { LIMITS } from "@/lib/media/process";
import { notify } from "@/lib/notify";
import { limitOrThrow, writeLimit } from "@/lib/rate-limit";
import { anonymousSummary, getSummaries, getSummary } from "@/lib/users/summary";
import { viewerCountries, visibleToSql } from "@/lib/visibility";
import { storyAccess } from "./access";
import { createStory } from "./create";
import { authorStories } from "./queries";
import type { StoryCommentView, StoryView, StoryViewer } from "./types";

/** Stories einer Autorin laden (aktiv oder Highlights eines Titels / einzelner IDs). */
export async function loadStories(input: { authorId: string; highlights?: boolean; title?: string | null; ids?: string[] }) {
  return run(async (): Promise<StoryView[]> => {
    const user = await requireUser();
    const data = parse(
      z.object({ authorId: z.uuid(), highlights: z.boolean().optional(), title: z.string().max(60).nullish(), ids: z.array(z.uuid()).max(50).optional() }),
      input,
    );
    const countries = await viewerCountries(user);
    return authorStories(data.authorId, user, countries, { highlights: data.highlights, title: data.title === undefined ? undefined : data.title, ids: data.ids });
  });
}

/** Story als gesehen markieren; Inkognito-Betrachter werden markiert und erscheinen mit Milchglas-Avatar. */
export async function markStoryViewed(storyId: string) {
  return run(async () => {
    const user = await requireUser();
    await limitOrThrow(`story-view:${user.id}`, 300, 60);
    const s = await storyAccess(user, parse(z.uuid(), storyId), await viewerCountries(user));
    if (!s || s.authorId === user.id) return { recorded: false };
    const res = await db
      .insert(storyViews)
      .values({ storyId: s.id, viewerId: user.id, incognito: user.incognito })
      .onConflictDoNothing()
      .returning({ id: storyViews.storyId });
    if (res.length) await track(s.authorId, "story_view", { viewerId: user.id, source: "story", refId: s.id });
    return { recorded: res.length > 0 };
  });
}

export async function loadStoryComments(storyId: string) {
  return run(async (): Promise<StoryCommentView[]> => {
    const user = await requireUser();
    const countries = await viewerCountries(user);
    const s = await storyAccess(user, parse(z.uuid(), storyId), countries);
    if (!s) throw new ApiError("NOT_FOUND");
    const rows = await db
      .select()
      .from(storyComments)
      .where(and(eq(storyComments.storyId, s.id), visibleToSql(storyComments.authorId, user.id, countries, { requireKyc: false })))
      .orderBy(asc(storyComments.createdAt))
      .limit(300);
    const sums = await getSummaries(
      rows.map((r) => r.authorId),
      user,
    );
    return rows.map((r) => ({
      id: r.id,
      author: toAuthor(sums.get(r.authorId)),
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      canDelete: r.authorId === user.id || s.authorId === user.id || isStaff(user),
    }));
  });
}

export async function addStoryComment(input: { storyId: string; body: string }) {
  return run(async (): Promise<StoryCommentView> => {
    const user = await requireUser({ complete: true });
    const data = parse(z.object({ storyId: z.uuid(), body: z.string().trim().min(1, "Der Kommentar ist leer").max(1000) }), input);
    await writeLimit(user.id, "story-comment", 20);
    const s = await storyAccess(user, data.storyId, await viewerCountries(user));
    if (!s) throw new ApiError("NOT_FOUND");
    const [row] = await db.insert(storyComments).values({ storyId: s.id, authorId: user.id, body: data.body }).returning();
    if (s.authorId !== user.id) {
      await track(s.authorId, "story_comment", { viewerId: user.id, source: "story", refId: s.id });
      const me = await getSummary(user.id, user);
      await notify(s.authorId, { type: "story_comment", title: `${me?.name ?? user.username} hat deine Story kommentiert`, body: data.body.slice(0, 140), href: `/stories/${s.id}`, actorId: user.id });
    }
    const me = await getSummary(user.id, user);
    return { id: row!.id, author: toAuthor(me ?? undefined), body: row!.body, createdAt: row!.createdAt.toISOString(), canDelete: true };
  });
}

export async function deleteStoryComment(id: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const [c] = await db
      .select({ id: storyComments.id, authorId: storyComments.authorId, owner: stories.authorId })
      .from(storyComments)
      .innerJoin(stories, eq(stories.id, storyComments.storyId))
      .where(eq(storyComments.id, parse(z.uuid(), id)));
    if (!c) throw new ApiError("NOT_FOUND");
    if (c.authorId !== user.id && c.owner !== user.id && !isStaff(user)) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
    await db.delete(storyComments).where(eq(storyComments.id, c.id));
    return { id };
  });
}

const StickerInput = z.object({
  type: z.enum(["city", "available_today", "book_link"]),
  value: z.string().trim().max(60).optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

const PublishInput = z.object({
  mediaId: z.uuid(),
  overlayText: z.string().trim().max(200).nullish(),
  stickers: z.array(StickerInput).max(6).default([]),
  highlightTitle: z.string().trim().max(40).nullish(),
});

/** Story veröffentlichen (nur Escorts und Clubs, Profil vollständig). */
export async function publishStory(input: z.input<typeof PublishInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["escort", "club"] });
    const data = parse(PublishInput, input);
    await limitOrThrow(`story:${user.id}`, 30, 86400, "Maximal 30 Stories pro Tag");
    const [m] = await db.select().from(media).where(and(eq(media.id, data.mediaId), eq(media.ownerId, user.id)));
    if (!m || m.status === "rejected" || (m.kind !== "image" && m.kind !== "video")) throw new ApiError("INVALID", "Bitte lade ein Bild oder Video hoch");
    if (m.kind === "video" && (m.durationSec ?? 0) > LIMITS.storyVideoSec) throw new ApiError("INVALID", `Videos dürfen höchstens ${LIMITS.storyVideoSec} Sekunden lang sein`);
    if (data.stickers.some((s) => s.type === "book_link") && user.accountType !== "escort") throw new ApiError("INVALID", "Der Buchungs-Sticker ist nur für Escorts verfügbar");
    const story = await createStory({ authorId: user.id, mediaId: m.id, overlayText: data.overlayText || null, stickers: data.stickers });
    if (data.highlightTitle) await db.update(stories).set({ highlight: true, highlightTitle: data.highlightTitle }).where(eq(stories.id, story.id));
    revalidatePath("/dashboard/stories");
    return { id: story.id };
  });
}

/** Als Highlight markieren (bleibt im Profil) oder Markierung entfernen. */
export async function setStoryHighlight(input: { id: string; title: string | null }) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["escort", "club"] });
    const data = parse(z.object({ id: z.uuid(), title: z.string().trim().max(40).nullable() }), input);
    await writeLimit(user.id, "story-highlight", 30);
    const res = await db
      .update(stories)
      .set({ highlight: data.title !== null, highlightTitle: data.title || null })
      .where(and(eq(stories.id, data.id), eq(stories.authorId, user.id)))
      .returning({ id: stories.id });
    if (!res.length) throw new ApiError("NOT_FOUND");
    revalidatePath("/dashboard/stories");
    return { id: data.id };
  });
}

export async function deleteStory(id: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const res = await db
      .delete(stories)
      .where(and(eq(stories.id, parse(z.uuid(), id)), isStaff(user) ? undefined : eq(stories.authorId, user.id)))
      .returning({ id: stories.id });
    if (!res.length) throw new ApiError("NOT_FOUND");
    revalidatePath("/dashboard/stories");
    return { id };
  });
}

/** Viewer-Liste für die Erstellerin; Inkognito-Viewer nur mit Milchglas-Avatar, ohne Name und Link. */
export async function storyViewers(storyId: string) {
  return run(async (): Promise<StoryViewer[]> => {
    const user = await requireUser({ complete: true });
    const [s] = await db.select({ authorId: stories.authorId }).from(stories).where(eq(stories.id, parse(z.uuid(), storyId)));
    if (!s || (s.authorId !== user.id && !isStaff(user))) throw new ApiError("NOT_FOUND");
    const rows = await db
      .select({ viewerId: storyViews.viewerId, incognito: storyViews.incognito, viewedAt: storyViews.viewedAt, avatar: users.avatarMediaId, kind: reactions.kind })
      .from(storyViews)
      .innerJoin(users, eq(users.id, storyViews.viewerId))
      .leftJoin(reactions, and(eq(reactions.targetType, "story"), eq(reactions.targetId, storyViews.storyId), eq(reactions.userId, storyViews.viewerId)))
      .where(and(eq(storyViews.storyId, storyId), eq(users.status, "active")))
      .orderBy(desc(storyViews.viewedAt))
      .limit(500);
    const sums = await getSummaries(
      rows.filter((r) => !r.incognito).map((r) => r.viewerId),
      user,
    );
    return rows.map((r, i) => ({
      key: r.incognito ? `anon-${i}` : r.viewerId,
      user: r.incognito ? anonymousSummary(r.avatar) : toAuthor(sums.get(r.viewerId)),
      viewedAt: r.viewedAt.toISOString(),
      reaction: r.kind ?? null,
    }));
  });
}

export async function storyCounts() {
  return run(async () => {
    const user = await requireUser();
    const [r] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM stories WHERE author_id = ${user.id} AND expires_at > now()`)).rows;
    return { active: r?.n ?? 0 };
  });
}
