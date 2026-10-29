"use server";

import { and, asc, desc, eq, ilike, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { parse } from "./validate";
import { db } from "@/db";
import { groupMembers, groups, media, postMedia, posts, reactions, users } from "@/db/schema";
import { notifyMany } from "@/lib/notify";
import { extractTags } from "@/components/shared/rich-text";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { canPostInGroup, getMembership } from "@/lib/groups/access";
import { mediaUrl } from "@/lib/media/urls";
import { limitOrThrow, writeLimit } from "@/lib/rate-limit";
import { getSummaries } from "@/lib/users/summary";
import { viewerCountries, visibleToSql } from "@/lib/visibility";
import { getPost, postAccess } from "./access";
import { refFromUrl, resolveEmbeds, embedKey } from "./embeds";
import { hydratePosts, reactionSummaries, toAuthor } from "./hydrate";
import type { DraftView, EmbedPreview, MentionHit, PostView, ReactionKind, Reactor } from "./types";
import { assertOwnMedia } from "./media";
import { attachMedia, BodyInput, cleanEmbeds, EmbedInput, insertPost, MediaIdsInput, notifyMentions } from "./write";
import { storyAccess } from "@/lib/stories/access";
import { commentAccess } from "./comment-access";

const CreateInput = z.object({
  context: z.enum(["feed", "group"]),
  groupId: z.uuid().optional(),
  body: BodyInput,
  mediaIds: MediaIdsInput,
  embeds: z.array(EmbedInput).max(5).default([]),
  visibility: z.enum(["public", "followers", "members"]).default("public"),
  draftId: z.uuid().optional(),
});

/** Feed- oder Gruppenbeitrag veröffentlichen. */
export async function createPost(input: z.input<typeof CreateInput>) {
  return run(async (): Promise<PostView> => {
    const user = await requireUser({ complete: true });
    const data = parse(CreateInput, input);
    await limitOrThrow(`post:${user.id}`, 20, 600, "Du hast in kurzer Zeit sehr viele Beiträge erstellt. Bitte warte etwas.");
    const countries = await viewerCountries(user);
    let approved = true;
    if (data.context === "group") {
      if (!data.groupId) throw new ApiError("INVALID", "Gruppe fehlt");
      const [g] = await db.select().from(groups).where(eq(groups.id, data.groupId));
      if (!g) throw new ApiError("NOT_FOUND");
      const m = await getMembership(g.id, user.id);
      if (!canPostInGroup(m)) throw new ApiError("FORBIDDEN", "Nur Mitglieder können in dieser Gruppe posten");
      approved = !g.requirePostApproval || m!.role !== "member";
    }
    const embeds = await cleanEmbeds(data.embeds, user, countries);
    const row = await insertPost(
      user,
      { context: data.context, groupId: data.context === "group" ? data.groupId : null, body: data.body, embeds, visibility: data.context === "group" ? "members" : data.visibility, approved },
      data.mediaIds,
      { href: (id) => `/feed/${id}`, notifyMentions: approved },
    );
    if (data.draftId) await db.delete(posts).where(and(eq(posts.id, data.draftId), eq(posts.authorId, user.id), eq(posts.isDraft, true)));
    if (!approved && data.groupId) {
      const [g] = await db.select({ name: groups.name, slug: groups.slug }).from(groups).where(eq(groups.id, data.groupId));
      const mods = await db
        .select({ id: groupMembers.userId })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, data.groupId), eq(groupMembers.status, "active"), inArray(groupMembers.role, ["owner", "admin", "moderator"])));
      await notifyMany(
        mods.map((m) => m.id),
        { type: "group_pending", title: `Neuer Beitrag in „${g?.name}“ wartet auf Freigabe`, href: `/gruppen/${g?.slug}/verwalten`, actorId: user.id },
      );
    }
    const [view] = await hydratePosts([row], user, { countries });
    return view!;
  });
}

const UpdateInput = z.object({
  id: z.uuid(),
  body: BodyInput,
  mediaIds: MediaIdsInput,
  embeds: z.array(EmbedInput).max(5).default([]),
  visibility: z.enum(["public", "followers", "members"]).optional(),
});

/** Eigenen Beitrag bearbeiten ("bearbeitet"-Label). */
export async function updatePost(input: z.input<typeof UpdateInput>) {
  return run(async (): Promise<PostView> => {
    const user = await requireUser({ complete: true });
    const data = parse(UpdateInput, input);
    await writeLimit(user.id, "post-edit", 30);
    const p = await getPost(data.id);
    if (!p || p.deletedAt) throw new ApiError("NOT_FOUND");
    if (p.authorId !== user.id) throw new ApiError("FORBIDDEN", "Nur eigene Beiträge können bearbeitet werden");
    if (!data.body && !data.mediaIds.length && !data.embeds.length) throw new ApiError("INVALID", "Der Beitrag ist leer");
    const countries = await viewerCountries(user);
    const embeds = await cleanEmbeds(data.embeds, user, countries);
    const before = extractTags(p.body).mentions;
    const [row] = await db
      .update(posts)
      .set({
        body: data.body,
        embeds,
        hashtags: extractTags(data.body).hashtags,
        visibility: p.context === "feed" && data.visibility ? data.visibility : p.visibility,
        editedAt: p.isDraft ? null : new Date(),
      })
      .where(eq(posts.id, p.id))
      .returning();
    const existing = await db.select({ id: postMedia.mediaId }).from(postMedia).where(eq(postMedia.postId, p.id));
    const fresh = data.mediaIds.filter((id) => !existing.some((e) => e.id === id));
    await assertOwnMedia(user.id, fresh, ["post", "comment", "group"]);
    await attachMedia(p.id, data.mediaIds);
    if (!p.isDraft && p.approved) await notifyMentions(user, data.body, p.context === "forum" ? `/forum/thread/${p.threadId}?beitrag=${p.id}` : `/feed/${p.id}`, before);
    const access = await postAccess(user, row!, countries);
    const [view] = await hydratePosts([row!], user, { countries, adultOnly: access.adultOnly, moderator: access.moderator, authorStats: p.context === "forum" });
    return view!;
  });
}

/** Weiches Löschen: eigener Beitrag oder Moderator des Kontexts. */
export async function deletePost(id: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    await writeLimit(user.id, "post-delete", 30);
    const p = await getPost(parse(z.uuid(), id));
    if (!p || p.deletedAt) throw new ApiError("NOT_FOUND");
    if (p.authorId !== user.id) {
      const access = await postAccess(user, p, await viewerCountries(user));
      if (!access.moderator) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
    }
    await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, p.id));
    if (p.context === "forum" && p.threadId) {
      await db.execute(sql`UPDATE forum_threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = ${p.threadId}`);
    }
    return { id: p.id };
  });
}

/** Einzelnen Beitrag (nach Aktion) neu laden. */
export async function getPostView(id: string) {
  return run(async (): Promise<PostView> => {
    const viewer = await getSessionUser();
    const p = await getPost(parse(z.uuid(), id));
    if (!p) throw new ApiError("NOT_FOUND");
    const countries = await viewerCountries(viewer);
    const access = await postAccess(viewer, p, countries);
    if (!access.canView) throw new ApiError("NOT_FOUND");
    const [view] = await hydratePosts([p], viewer, { countries, adultOnly: access.adultOnly, moderator: access.moderator, authorStats: p.context === "forum" });
    return view!;
  });
}

const ReactInput = z.object({
  targetType: z.enum(["post", "comment", "story"]),
  targetId: z.uuid(),
  kind: z.enum(["like", "love", "fire", "laugh", "wow", "sad"]),
});

/** Reaktion setzen; gleiche Reaktion erneut = entfernen, andere = ersetzen. */
export async function toggleReaction(input: z.input<typeof ReactInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = parse(ReactInput, input);
    await writeLimit(user.id, "react", 120);
    await assertCanInteract(user, data.targetType, data.targetId);
    const where = and(eq(reactions.targetType, data.targetType), eq(reactions.targetId, data.targetId), eq(reactions.userId, user.id));
    const [existing] = await db.select({ kind: reactions.kind }).from(reactions).where(where);
    let delta = 0;
    if (existing?.kind === data.kind) {
      await db.delete(reactions).where(where);
      delta = -1;
    } else if (existing) {
      await db.update(reactions).set({ kind: data.kind, createdAt: new Date() }).where(where);
    } else {
      await db.insert(reactions).values({ targetType: data.targetType, targetId: data.targetId, userId: user.id, kind: data.kind });
      delta = 1;
    }
    if (delta && data.targetType === "post") await db.execute(sql`UPDATE posts SET reaction_count = GREATEST(reaction_count + ${delta}, 0) WHERE id = ${data.targetId}`);
    if (delta && data.targetType === "story") {
      const { onStoryReaction } = await import("@/lib/stories/events");
      await onStoryReaction(user, data.targetId, delta > 0);
    }
    const map = await reactionSummaries(data.targetType, [data.targetId], user.id);
    return map.get(data.targetId)!;
  });
}

async function assertCanInteract(user: Awaited<ReturnType<typeof requireUser>>, type: "post" | "comment" | "story", id: string) {
  const countries = await viewerCountries(user);
  if (type === "post") {
    const p = await getPost(id);
    if (!p) throw new ApiError("NOT_FOUND");
    const a = await postAccess(user, p, countries);
    if (!a.canView) throw new ApiError("NOT_FOUND");
    if (!a.canInteract) throw new ApiError("FORBIDDEN", a.locked ? "Das Thema ist geschlossen" : "Keine Berechtigung");
  } else if (type === "comment") {
    const a = await commentAccess(user, id, countries);
    if (!a.canInteract) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
  } else {
    if (!(await storyAccess(user, id, countries))) throw new ApiError("NOT_FOUND");
  }
}

/** "Wer hat reagiert" – Liste der Reagierenden (sichtbare Profile). */
export async function listReactors(input: { targetType: "post" | "comment" | "story"; targetId: string }) {
  return run(async (): Promise<Reactor[]> => {
    const viewer = await getSessionUser();
    const data = parse(z.object({ targetType: z.enum(["post", "comment", "story"]), targetId: z.uuid() }), input);
    const countries = await viewerCountries(viewer);
    if (data.targetType === "post") {
      const p = await getPost(data.targetId);
      if (!p || !(await postAccess(viewer, p, countries)).canView) throw new ApiError("NOT_FOUND");
    } else if (data.targetType === "story") {
      if (!viewer || !(await storyAccess(viewer, data.targetId, countries))) throw new ApiError("NOT_FOUND");
    } else if (!(await commentAccess(viewer, data.targetId, countries)).canView) throw new ApiError("NOT_FOUND");
    const rows = await db
      .select({ userId: reactions.userId, kind: reactions.kind })
      .from(reactions)
      .where(and(eq(reactions.targetType, data.targetType), eq(reactions.targetId, data.targetId), visibleToSql(reactions.userId, viewer?.id ?? null, countries, { requireKyc: false })))
      .orderBy(desc(reactions.createdAt))
      .limit(200);
    const sums = await getSummaries(
      rows.map((r) => r.userId),
      viewer,
    );
    return rows.filter((r) => sums.has(r.userId)).map((r) => ({ user: toAuthor(sums.get(r.userId)), kind: r.kind as ReactionKind }));
  });
}

/** @-Autovervollständigung: sichtbare, aktive Benutzernamen. */
export async function searchMentions(q: string) {
  return run(async (): Promise<MentionHit[]> => {
    const user = await requireUser();
    const term = parse(z.string().max(20), q).toLowerCase().replace(/[^a-z0-9._]/g, "");
    if (term.length < 1) return [];
    await limitOrThrow(`mention:${user.id}`, 120, 60);
    const countries = await viewerCountries(user);
    const rows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(ilike(users.username, `${term}%`), ne(users.id, user.id), visibleToSql(users.id, user.id, countries)))
      .orderBy(asc(users.username))
      .limit(8);
    const sums = await getSummaries(
      rows.map((r) => r.id),
      user,
    );
    return rows.map((r) => {
      const s = sums.get(r.id)!;
      return { username: r.username, name: s.name, avatarUrl: s.avatarUrl, accountType: s.accountType };
    });
  });
}

/** Eingefügten Poppsie-Link in eine Vorschaukarte auflösen. */
export async function resolveLink(url: string) {
  return run(async (): Promise<EmbedPreview | null> => {
    const user = await requireUser();
    await limitOrThrow(`embed:${user.id}`, 60, 60);
    const ref = await refFromUrl(parse(z.string().max(500), url));
    if (!ref) return null;
    const map = await resolveEmbeds([ref], user, await viewerCountries(user));
    const preview = map.get(embedKey(ref));
    return preview?.available ? preview : null;
  });
}

/** Vorschau für eine bekannte Einbettung (z. B. "Teilen in…"). */
export async function previewEmbed(ref: { type: "profile" | "thread" | "post" | "group" | "highlight"; id: string }) {
  return run(async (): Promise<EmbedPreview | null> => {
    const user = await requireUser();
    const data = parse(EmbedInput, ref);
    const map = await resolveEmbeds([data], user, await viewerCountries(user));
    const p = map.get(embedKey(data));
    return p?.available ? p : null;
  });
}

const DraftInput = z.object({
  id: z.uuid().optional(),
  context: z.enum(["feed", "group", "forum"]),
  groupId: z.uuid().nullish(),
  threadId: z.uuid().nullish(),
  body: BodyInput,
  mediaIds: MediaIdsInput,
});

/** Entwurf speichern (ein Beitrag mit is_draft). */
export async function saveDraft(input: z.input<typeof DraftInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = parse(DraftInput, input);
    await writeLimit(user.id, "draft", 30);
    if (data.id) {
      const [d] = await db.select().from(posts).where(and(eq(posts.id, data.id), eq(posts.authorId, user.id), eq(posts.isDraft, true)));
      if (d) {
        await db.update(posts).set({ body: data.body, createdAt: new Date() }).where(eq(posts.id, d.id));
        await assertOwnMedia(user.id, data.mediaIds, ["post", "comment", "group"]);
        await attachMedia(d.id, data.mediaIds);
        return { id: d.id };
      }
    }
    const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM posts WHERE author_id = ${user.id} AND is_draft`)).rows as [{ n: number }];
    if (n >= 20) throw new ApiError("INVALID", "Maximal 20 Entwürfe. Lösche zuerst alte Entwürfe.");
    const row = await insertPost(
      user,
      { context: data.context, groupId: data.groupId ?? null, threadId: data.threadId ?? null, body: data.body, isDraft: true, approved: false },
      data.mediaIds,
      { href: () => "", notifyMentions: false },
    );
    return { id: row.id };
  });
}

export async function listDrafts(input: { context: "feed" | "group" | "forum"; groupId?: string | null; threadId?: string | null }) {
  return run(async (): Promise<DraftView[]> => {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.authorId, user.id),
          eq(posts.isDraft, true),
          isNull(posts.deletedAt),
          eq(posts.context, input.context),
          input.groupId ? eq(posts.groupId, input.groupId) : isNull(posts.groupId),
          input.threadId ? eq(posts.threadId, input.threadId) : isNull(posts.threadId),
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(20);
    const ids = rows.map((r) => r.id);
    const ms = ids.length
      ? await db
          .select({ postId: postMedia.postId, id: media.id, kind: media.kind })
          .from(postMedia)
          .innerJoin(media, eq(media.id, postMedia.mediaId))
          .where(inArray(postMedia.postId, ids))
          .orderBy(asc(postMedia.sortOrder))
      : [];
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      updatedAt: r.createdAt.toISOString(),
      media: ms
        .filter((m) => m.postId === r.id && (m.kind === "image" || m.kind === "video"))
        .map((m) => ({ id: m.id, kind: m.kind as "image" | "video", thumbUrl: mediaUrl(m.id, m.kind === "image" ? "t" : "o"), url: mediaUrl(m.id, "o") })),
    }));
  });
}

export async function deleteDraft(id: string) {
  return run(async () => {
    const user = await requireUser();
    await db.delete(posts).where(and(eq(posts.id, parse(z.uuid(), id)), eq(posts.authorId, user.id), eq(posts.isDraft, true)));
    return { id };
  });
}

const ShareInput = z.object({
  target: z.union([z.literal("feed"), z.uuid()]),
  embed: EmbedInput,
  body: BodyInput.default(""),
  visibility: z.enum(["public", "followers", "members"]).default("public"),
});

/** "Teilen in…": Einbettung als neuen Beitrag im Feed oder in einer Gruppe veröffentlichen. */
export async function shareTo(input: z.input<typeof ShareInput>) {
  const parsed = ShareInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const, status: 422, error: "Ungültige Angaben" };
  const data = parsed.data;
  return createPost({
    context: data.target === "feed" ? "feed" : "group",
    groupId: data.target === "feed" ? undefined : data.target,
    body: data.body,
    embeds: [data.embed],
    mediaIds: [],
    visibility: data.visibility,
  });
}

/** Gruppen, in die der Benutzer teilen darf. */
export async function myShareTargets() {
  return run(async () => {
    const user = await requireUser();
    const rows = await db.execute<{ id: string; name: string; slug: string }>(sql`
      SELECT g.id, g.name, g.slug FROM groups g JOIN group_members m ON m.group_id = g.id
      WHERE m.user_id = ${user.id} AND m.status = 'active' ORDER BY g.name LIMIT 100`);
    return rows.rows;
  });
}

