"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, media, posts } from "@/db/schema";
import { ApiError, isStaff, requireUser, run } from "@/lib/auth/guards";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { writeLimit } from "@/lib/rate-limit";
import { getSummaries, getSummary } from "@/lib/users/summary";
import { viewerCountries, visibleToSql } from "@/lib/visibility";
import { getPost, postAccess } from "./access";
import { commentAccess } from "./comment-access";
import { postHref, reactionSummaries, toAuthor } from "./hydrate";
import { mediaByIds, mediaView } from "./media";
import { MAX_COMMENT, MAX_DEPTH, type CommentView } from "./types";
import { notifyMentions } from "./write";

type Row = typeof comments.$inferSelect;

async function hydrate(rows: Row[], viewer: SessionUser | null, opts: { adultOnly: boolean; moderator: boolean }): Promise<CommentView[]> {
  const live = rows.filter((r) => !r.deletedAt);
  const [sums, ms, reacts] = await Promise.all([
    getSummaries(
      live.map((r) => r.authorId),
      viewer,
    ),
    mediaByIds(live.map((r) => r.mediaId).filter(Boolean) as string[]),
    reactionSummaries(
      "comment",
      live.map((r) => r.id),
      viewer?.id ?? null,
    ),
  ]);
  return rows.map((r) => {
    const own = viewer?.id === r.authorId;
    const m = r.mediaId ? ms.get(r.mediaId) : null;
    const deleted = Boolean(r.deletedAt);
    return {
      id: r.id,
      postId: r.postId,
      parentId: r.parentId,
      depth: r.depth,
      author: toAuthor(deleted ? undefined : sums.get(r.authorId)),
      body: deleted ? "" : r.body,
      media: !deleted && m ? mediaView(m, { guest: !viewer, adultOnly: opts.adultOnly }) : null,
      reactions: reacts.get(r.id) ?? { counts: {}, total: 0, mine: null },
      editedAt: r.editedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      deleted,
      canEdit: own && !deleted,
      canDelete: !deleted && (own || opts.moderator || isStaff(viewer)),
    };
  });
}

/** Alle Kommentare eines Beitrags (Baum wird im Client aufgebaut). */
export async function loadComments(postId: string) {
  return run(async (): Promise<CommentView[]> => {
    const viewer = await getSessionUser();
    const p = await getPost(z.uuid().parse(postId));
    if (!p) throw new ApiError("NOT_FOUND");
    const countries = await viewerCountries(viewer);
    const a = await postAccess(viewer, p, countries);
    if (!a.canView) throw new ApiError("NOT_FOUND");
    const rows = await db
      .select()
      .from(comments)
      .where(and(eq(comments.postId, p.id), visibleToSql(comments.authorId, viewer?.id ?? null, countries)))
      .orderBy(asc(comments.createdAt))
      .limit(500);
    // Gelöschte Kommentare nur als Platzhalter, wenn sie Antworten haben.
    const parents = new Set(rows.filter((r) => !r.deletedAt).map((r) => r.parentId));
    const keep = rows.filter((r) => !r.deletedAt || parents.has(r.id));
    return hydrate(keep, viewer, { adultOnly: a.adultOnly, moderator: a.moderator });
  });
}

const AddInput = z.object({
  postId: z.uuid(),
  parentId: z.uuid().nullish(),
  body: z
    .string()
    .max(MAX_COMMENT, `Maximal ${MAX_COMMENT} Zeichen`)
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()),
  mediaId: z.uuid().nullish(),
});

export async function addComment(input: z.input<typeof AddInput>) {
  return run(async (): Promise<CommentView> => {
    const user = await requireUser({ complete: true });
    const data = AddInput.parse(input);
    await writeLimit(user.id, "comment", 20);
    if (!data.body && !data.mediaId) throw new ApiError("INVALID", "Der Kommentar ist leer");
    const p = await getPost(data.postId);
    if (!p) throw new ApiError("NOT_FOUND");
    const countries = await viewerCountries(user);
    const a = await postAccess(user, p, countries);
    if (!a.canView) throw new ApiError("NOT_FOUND");
    if (!a.canInteract) throw new ApiError("FORBIDDEN", "Du kannst hier nicht kommentieren");
    let depth = 0;
    let parentAuthor: string | null = null;
    if (data.parentId) {
      const [parent] = await db.select().from(comments).where(and(eq(comments.id, data.parentId), eq(comments.postId, p.id)));
      if (!parent) throw new ApiError("NOT_FOUND", "Kommentar nicht gefunden");
      depth = Math.min(parent.depth + 1, MAX_DEPTH);
      parentAuthor = parent.authorId;
    }
    if (data.mediaId) {
      const [m] = await db.select({ owner: media.ownerId, kind: media.kind }).from(media).where(eq(media.id, data.mediaId));
      if (!m || m.owner !== user.id || (m.kind !== "image" && m.kind !== "video")) throw new ApiError("INVALID", "Ungültiges Medium");
    }
    const [row] = await db
      .insert(comments)
      .values({ postId: p.id, parentId: data.parentId ?? null, depth, authorId: user.id, body: data.body, mediaId: data.mediaId ?? null })
      .returning();
    await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, p.id));

    const href = postHref(p);
    const me = await getSummary(user.id, user);
    const targets = new Set([p.authorId, parentAuthor].filter((x): x is string => Boolean(x) && x !== user.id));
    for (const t of targets) {
      await notify(t, {
        type: "comment",
        title: t === parentAuthor ? `${me?.name ?? user.username} hat auf deinen Kommentar geantwortet` : `${me?.name ?? user.username} hat deinen Beitrag kommentiert`,
        body: data.body.slice(0, 140),
        href,
        actorId: user.id,
      });
    }
    await notifyMentions(user, data.body, href, []);
    const [view] = await hydrate([row!], user, { adultOnly: a.adultOnly, moderator: a.moderator });
    return view!;
  });
}

export async function editComment(input: { id: string; body: string }) {
  return run(async (): Promise<CommentView> => {
    const user = await requireUser({ complete: true });
    const data = z.object({ id: z.uuid(), body: z.string().trim().min(1, "Der Kommentar ist leer").max(MAX_COMMENT) }).parse(input);
    await writeLimit(user.id, "comment-edit", 30);
    const countries = await viewerCountries(user);
    const a = await commentAccess(user, data.id, countries);
    if (!a.comment) throw new ApiError("NOT_FOUND");
    if (a.comment.authorId !== user.id) throw new ApiError("FORBIDDEN", "Nur eigene Kommentare können bearbeitet werden");
    const [row] = await db.update(comments).set({ body: data.body, editedAt: new Date() }).where(eq(comments.id, data.id)).returning();
    const [view] = await hydrate([row!], user, { adultOnly: a.adultOnly, moderator: a.moderator });
    return view!;
  });
}

export async function deleteComment(id: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    await writeLimit(user.id, "comment-delete", 30);
    const countries = await viewerCountries(user);
    const a = await commentAccess(user, z.uuid().parse(id), countries);
    if (!a.comment) throw new ApiError("NOT_FOUND");
    if (a.comment.authorId !== user.id && !a.moderator && !isStaff(user)) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
    await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, a.comment.id));
    await db.update(posts).set({ commentCount: sql`GREATEST(${posts.commentCount} - 1, 0)` }).where(eq(posts.id, a.comment.postId));
    return { id };
  });
}
