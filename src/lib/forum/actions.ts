"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { parse } from "@/lib/content/validate";
import { db } from "@/db";
import { forumSubscriptions, forumThreads, pollOptions, polls, pollVotes, posts } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { hydratePosts } from "@/lib/content/hydrate";
import type { PostView } from "@/lib/content/types";
import { BodyInput, cleanEmbeds, EmbedInput, insertPost, MediaIdsInput } from "@/lib/content/write";
import { notifyMany } from "@/lib/notify";
import { limitOrThrow, writeLimit } from "@/lib/rate-limit";
import { getSummary } from "@/lib/users/summary";
import { viewerCountries } from "@/lib/visibility";
import { canReadCategory, canWriteCategory, categoryById, isCategoryModerator } from "./access";
import { pageOfPost, pollFor } from "./queries";
import { THREAD_PREFIXES, type PollView } from "./types";

const TagsInput = z
  .array(z.string().trim().toLowerCase().max(30))
  .max(5)
  .default([])
  .transform((t) => [...new Set(t.map((x) => x.replace(/[^\p{L}0-9 _-]/gu, "")).filter((x) => x.length >= 2))]);

const PollInput = z
  .object({
    question: z.string().trim().min(3, "Frage zu kurz").max(200),
    options: z.array(z.string().trim().min(1).max(100)).min(2, "Mindestens zwei Antworten").max(10),
    multiple: z.boolean().default(false),
    closesAt: z.iso.datetime({ offset: true }).nullish(),
  })
  .nullish();

const ThreadInput = z.object({
  categoryId: z.uuid(),
  title: z.string().trim().min(5, "Der Titel ist zu kurz").max(140, "Der Titel ist zu lang"),
  prefix: z.enum(THREAD_PREFIXES).nullish(),
  tags: TagsInput,
  body: BodyInput.refine((s) => s.length >= 2, "Bitte schreibe einen Beitrag"),
  mediaIds: MediaIdsInput,
  embeds: z.array(EmbedInput).max(5).default([]),
  poll: PollInput,
});

/** Neues Thema mit erstem Beitrag und optionaler Umfrage. Ersteller abonniert automatisch. */
export async function createThread(input: z.input<typeof ThreadInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = parse(ThreadInput, input);
    await limitOrThrow(`thread:${user.id}`, 10, 3600, "Du hast in kurzer Zeit viele Themen erstellt. Bitte warte etwas.");
    const cat = await categoryById(data.categoryId);
    if (!cat) throw new ApiError("NOT_FOUND");
    const hasChildren = (await db.execute(sql`SELECT 1 FROM forum_categories WHERE parent_id = ${cat.id} LIMIT 1`)).rows.length > 0;
    if (hasChildren) throw new ApiError("INVALID", "Bitte wähle ein Unterforum");
    if (!(await canWriteCategory(user, cat))) throw new ApiError("FORBIDDEN", "In dieser Kategorie darfst du keine Themen erstellen");
    const countries = await viewerCountries(user);
    const [thread] = await db
      .insert(forumThreads)
      .values({ categoryId: cat.id, authorId: user.id, title: data.title, prefix: data.prefix ?? null, tags: data.tags })
      .returning();
    await insertPost(
      user,
      { context: "forum", threadId: thread!.id, groupId: cat.groupId, body: data.body, embeds: await cleanEmbeds(data.embeds, user, countries) },
      data.mediaIds,
      { href: () => `/forum/thread/${thread!.id}` },
    );
    if (data.poll) {
      const [p] = await db
        .insert(polls)
        .values({ threadId: thread!.id, question: data.poll.question, multiple: data.poll.multiple, closesAt: data.poll.closesAt ? new Date(data.poll.closesAt) : null })
        .returning();
      await db.insert(pollOptions).values(data.poll.options.map((label, i) => ({ pollId: p!.id, label, sortOrder: i })));
    }
    await db.insert(forumSubscriptions).values({ userId: user.id, threadId: thread!.id }).onConflictDoNothing();
    return { id: thread!.id };
  });
}

async function loadThreadFor(user: SessionUser, threadId: string) {
  const [t] = await db.select().from(forumThreads).where(eq(forumThreads.id, threadId));
  if (!t) throw new ApiError("NOT_FOUND");
  const cat = await categoryById(t.categoryId);
  if (!cat || !(await canReadCategory(user, cat))) throw new ApiError("NOT_FOUND");
  return { t, cat, moderator: await isCategoryModerator(user, cat) };
}

const ReplyInput = z.object({
  threadId: z.uuid(),
  body: BodyInput,
  mediaIds: MediaIdsInput,
  embeds: z.array(EmbedInput).max(5).default([]),
  quoteId: z.uuid().nullish(),
  draftId: z.uuid().optional(),
});

/** Antwort schreiben (optional mit Zitat); Abonnenten werden benachrichtigt. */
export async function replyToThread(input: z.input<typeof ReplyInput>) {
  return run(async (): Promise<{ post: PostView; page: number }> => {
    const user = await requireUser({ complete: true });
    const data = parse(ReplyInput, input);
    await limitOrThrow(`reply:${user.id}`, 30, 600, "Du hast in kurzer Zeit sehr viele Beiträge geschrieben. Bitte warte etwas.");
    const { t, cat, moderator } = await loadThreadFor(user, data.threadId);
    if (t.locked && !moderator) throw new ApiError("FORBIDDEN", "Das Thema ist geschlossen");
    if (!(await canWriteCategory(user, cat))) throw new ApiError("FORBIDDEN", "In dieser Kategorie darfst du nicht schreiben");
    if (data.quoteId) {
      const [q] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, data.quoteId), eq(posts.threadId, t.id)));
      if (!q) throw new ApiError("INVALID", "Zitat nicht gefunden");
    }
    const countries = await viewerCountries(user);
    const row = await insertPost(
      user,
      { context: "forum", threadId: t.id, groupId: cat.groupId, body: data.body, quoteId: data.quoteId ?? null, embeds: await cleanEmbeds(data.embeds, user, countries) },
      data.mediaIds,
      { href: (id) => `/forum/thread/${t.id}?beitrag=${id}` },
    );
    if (data.draftId) await db.delete(posts).where(and(eq(posts.id, data.draftId), eq(posts.authorId, user.id), eq(posts.isDraft, true)));
    await db.update(forumThreads).set({ replyCount: sql`${forumThreads.replyCount} + 1`, lastPostAt: row.createdAt }).where(eq(forumThreads.id, t.id));

    const subs = await db
      .select({ id: forumSubscriptions.userId })
      .from(forumSubscriptions)
      .where(and(eq(forumSubscriptions.threadId, t.id), ne(forumSubscriptions.userId, user.id)));
    if (subs.length) {
      const me = await getSummary(user.id, user);
      await notifyMany(
        subs.map((s) => s.id),
        { type: "forum_reply", title: `Neue Antwort von ${me?.name ?? user.username} in „${t.title.slice(0, 60)}“`, body: data.body.slice(0, 140), href: `/forum/thread/${t.id}?beitrag=${row.id}`, actorId: user.id },
      );
    }
    const [post] = await hydratePosts([row], user, { countries, adultOnly: cat.adultOnlyMedia, moderator, authorStats: true });
    return { post: post!, page: await pageOfPost(t.id, user, countries, row.createdAt) };
  });
}

export async function toggleSubscription(threadId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    await writeLimit(user.id, "forum-sub");
    await loadThreadFor(user, parse(z.uuid(), threadId));
    const where = and(eq(forumSubscriptions.userId, user.id), eq(forumSubscriptions.threadId, threadId));
    const existing = await db.select().from(forumSubscriptions).where(where);
    if (existing.length) {
      await db.delete(forumSubscriptions).where(where);
      return { subscribed: false };
    }
    await db.insert(forumSubscriptions).values({ userId: user.id, threadId });
    return { subscribed: true };
  });
}

const ModInput = z.object({
  threadId: z.uuid(),
  action: z.enum(["pin", "unpin", "lock", "unlock", "solve", "unsolve", "move", "delete"]),
  categoryId: z.uuid().optional(),
});

/** Moderation: Anpinnen, Schliessen, Verschieben, Löschen. "Gelöst" darf auch der Ersteller setzen. */
export async function moderateThread(input: z.input<typeof ModInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = parse(ModInput, input);
    await writeLimit(user.id, "forum-mod", 60);
    const { t, cat, moderator } = await loadThreadFor(user, data.threadId);
    const authorAllowed = (data.action === "solve" || data.action === "unsolve") && t.authorId === user.id;
    if (!moderator && !authorAllowed) throw new ApiError("FORBIDDEN", "Nur Moderatoren dürfen das");
    const set: Partial<typeof forumThreads.$inferInsert> = {};
    if (data.action === "pin" || data.action === "unpin") set.pinned = data.action === "pin";
    if (data.action === "lock" || data.action === "unlock") set.locked = data.action === "lock";
    if (data.action === "solve" || data.action === "unsolve") set.solved = data.action === "solve";
    if (data.action === "delete") {
      await db.delete(forumThreads).where(eq(forumThreads.id, t.id));
      return { deleted: true, categorySlug: cat.slug };
    }
    if (data.action === "move") {
      const target = data.categoryId ? await categoryById(data.categoryId) : null;
      if (!target) throw new ApiError("INVALID", "Ziel-Kategorie fehlt");
      if (target.groupId !== cat.groupId) throw new ApiError("INVALID", "Themen können nicht zwischen Gruppen und Forum verschoben werden");
      if (!(await isCategoryModerator(user, target))) throw new ApiError("FORBIDDEN", "Keine Moderationsrechte in der Ziel-Kategorie");
      set.categoryId = target.id;
      await db.update(posts).set({ groupId: target.groupId }).where(eq(posts.threadId, t.id));
    }
    await db.update(forumThreads).set(set).where(eq(forumThreads.id, t.id));
    return { deleted: false, categorySlug: cat.slug };
  });
}

const EditThreadInput = z.object({
  threadId: z.uuid(),
  title: z.string().trim().min(5, "Der Titel ist zu kurz").max(140),
  prefix: z.enum(THREAD_PREFIXES).nullish(),
  tags: TagsInput,
});

export async function editThread(input: z.input<typeof EditThreadInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = parse(EditThreadInput, input);
    await writeLimit(user.id, "forum-edit", 30);
    const { t, moderator } = await loadThreadFor(user, data.threadId);
    if (t.authorId !== user.id && !moderator) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
    await db.update(forumThreads).set({ title: data.title, prefix: data.prefix ?? null, tags: data.tags }).where(eq(forumThreads.id, t.id));
    return { id: t.id };
  });
}

/** Abstimmen (Einfach- oder Mehrfachauswahl); erneutes Abstimmen ersetzt die Stimme. */
export async function votePoll(input: { pollId: string; optionIds: string[] }) {
  return run(async (): Promise<PollView> => {
    const user = await requireUser({ complete: true });
    const data = parse(z.object({ pollId: z.uuid(), optionIds: z.array(z.uuid()).min(1, "Bitte wähle eine Antwort").max(10) }), input);
    await writeLimit(user.id, "poll", 30);
    const [p] = await db.select().from(polls).where(eq(polls.id, data.pollId));
    if (!p) throw new ApiError("NOT_FOUND");
    const { t, cat } = await loadThreadFor(user, p.threadId);
    if (!(await canWriteCategory(user, cat))) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
    if (p.closesAt && p.closesAt.getTime() < Date.now()) throw new ApiError("INVALID", "Die Umfrage ist beendet");
    if (t.locked) throw new ApiError("INVALID", "Das Thema ist geschlossen");
    if (!p.multiple && data.optionIds.length > 1) throw new ApiError("INVALID", "Nur eine Antwort möglich");
    const opts = await db.select({ id: pollOptions.id }).from(pollOptions).where(eq(pollOptions.pollId, p.id));
    const valid = new Set(opts.map((o) => o.id));
    if (!data.optionIds.every((id) => valid.has(id))) throw new ApiError("INVALID", "Ungültige Antwort");
    await db.delete(pollVotes).where(and(eq(pollVotes.userId, user.id), inArray(pollVotes.optionId, [...valid])));
    await db.insert(pollVotes).values(data.optionIds.map((optionId) => ({ optionId, userId: user.id })));
    return (await pollFor(t.id, user.id))!;
  });
}
