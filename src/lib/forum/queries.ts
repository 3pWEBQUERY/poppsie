import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, max, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { forumCategories, forumReads, forumThreads, media, pollOptions, polls, pollVotes, postMedia, posts } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { toAuthor } from "@/lib/content/hydrate";
import { mediaUrl } from "@/lib/media/urls";
import { getSummaries } from "@/lib/users/summary";
import { visibleToSql } from "@/lib/visibility";
import type { Category } from "./access";
import type { CategoryNode, PollView, RelatedThread, ThreadListItem, ThreadSort } from "./types";

export const THREADS_PER_PAGE = 20;
export const POSTS_PER_PAGE = 20;

/** Kategorienbaum (ohne Gruppen-Foren) mit Themenanzahl und letzter Aktivität. */
export async function categoryTree(cats: Category[], readable: Set<string>): Promise<CategoryNode[]> {
  const visible = cats.filter((c) => !c.groupId && readable.has(c.id));
  const stats = visible.length
    ? await db
        .select({ id: forumThreads.categoryId, n: count(), last: max(forumThreads.lastPostAt) })
        .from(forumThreads)
        .where(inArray(forumThreads.categoryId, visible.map((c) => c.id)))
        .groupBy(forumThreads.categoryId)
    : [];
  const byId = new Map(stats.map((s) => [s.id, s]));
  const node = (c: Category): CategoryNode => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    threadCount: byId.get(c.id)?.n ?? 0,
    lastActivity: byId.get(c.id)?.last?.toISOString() ?? null,
    children: [],
  });
  const tops = visible.filter((c) => !c.parentId).map(node);
  for (const t of tops) {
    t.children = visible.filter((c) => c.parentId === t.id).map(node);
    for (const ch of t.children) {
      t.threadCount += ch.threadCount;
      if (ch.lastActivity && (!t.lastActivity || ch.lastActivity > t.lastActivity)) t.lastActivity = ch.lastActivity;
    }
  }
  return tops;
}

const excerptOf = (s: string) => {
  const t = s.replace(/\*\*|\*/g, "").replace(/\s+/g, " ").trim();
  return t.length > 220 ? `${t.slice(0, 219)}…` : t;
};

type ListOpts = { categoryIds: string[]; sort: ThreadSort; page: number; q?: string | null; tag?: string | null; perPage?: number };

/** Themenliste mit Autor, Auszug, Vorschaubild und letzter Antwort. */
export async function listThreads(viewer: SessionUser | null, countries: string[], opts: ListOpts): Promise<{ items: ThreadListItem[]; total: number }> {
  if (!opts.categoryIds.length) return { items: [], total: 0 };
  const per = opts.perPage ?? THREADS_PER_PAGE;
  const conds: SQL[] = [inArray(forumThreads.categoryId, opts.categoryIds), visibleToSql(forumThreads.authorId, viewer?.id ?? null, countries)];
  const q = opts.q?.trim().slice(0, 100);
  if (q) {
    conds.push(
      or(
        sql`${forumThreads.title} ILIKE ${"%" + q.replace(/[%_\\]/g, "\\$&") + "%"}`,
        sql`EXISTS (SELECT 1 FROM posts sp WHERE sp.thread_id = ${forumThreads.id} AND sp.deleted_at IS NULL
          AND to_tsvector('simple', sp.body) @@ plainto_tsquery('simple', ${q}))`,
      )!,
    );
  }
  if (opts.tag) conds.push(sql`${opts.tag} = ANY(${forumThreads.tags})`);
  const where = and(...conds);
  const top = sql`(${forumThreads.replyCount} + COALESCE((SELECT sum(tp.reaction_count) FROM posts tp WHERE tp.thread_id = ${forumThreads.id} AND tp.deleted_at IS NULL), 0))`;
  const order =
    opts.sort === "neu"
      ? [desc(forumThreads.pinned), desc(forumThreads.createdAt)]
      : opts.sort === "top"
        ? [desc(forumThreads.pinned), desc(top), desc(forumThreads.lastPostAt)]
        : [desc(forumThreads.pinned), desc(forumThreads.lastPostAt)];
  const [{ n }] = await db.select({ n: count() }).from(forumThreads).where(where);
  const rows = await db
    .select({ t: forumThreads, catName: forumCategories.name, catSlug: forumCategories.slug })
    .from(forumThreads)
    .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
    .where(where)
    .orderBy(...order)
    .limit(per)
    .offset(Math.max(0, opts.page - 1) * per);
  return { items: await decorateThreads(rows, viewer), total: n };
}

async function decorateThreads(rows: { t: typeof forumThreads.$inferSelect; catName: string; catSlug: string }[], viewer: SessionUser | null): Promise<ThreadListItem[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.t.id);
  const firsts = await db
    .selectDistinctOn([posts.threadId], { threadId: posts.threadId, id: posts.id, body: posts.body })
    .from(posts)
    .where(and(inArray(posts.threadId, ids), isNull(posts.deletedAt), eq(posts.isDraft, false)))
    .orderBy(posts.threadId, asc(posts.createdAt));
  const lasts = await db
    .selectDistinctOn([posts.threadId], { threadId: posts.threadId, id: posts.id, authorId: posts.authorId, at: posts.createdAt })
    .from(posts)
    .where(and(inArray(posts.threadId, ids), isNull(posts.deletedAt), eq(posts.isDraft, false)))
    .orderBy(posts.threadId, desc(posts.createdAt));
  const firstIds = firsts.map((f) => f.id);
  const thumbs = firstIds.length
    ? await db
        .selectDistinctOn([postMedia.postId], { postId: postMedia.postId, id: media.id, kind: media.kind, blur: media.blurForGuests })
        .from(postMedia)
        .innerJoin(media, eq(media.id, postMedia.mediaId))
        .where(and(inArray(postMedia.postId, firstIds), eq(media.kind, "image")))
        .orderBy(postMedia.postId, asc(postMedia.sortOrder))
    : [];
  const adult = new Map<string, boolean>();
  const catIds = [...new Set(rows.map((r) => r.t.categoryId))];
  const cats = await db.select({ id: forumCategories.id, adult: forumCategories.adultOnlyMedia }).from(forumCategories).where(inArray(forumCategories.id, catIds));
  for (const c of cats) adult.set(c.id, c.adult);
  const reads = viewer
    ? await db
        .select({ id: forumReads.threadId, at: forumReads.lastReadAt })
        .from(forumReads)
        .where(and(eq(forumReads.userId, viewer.id), inArray(forumReads.threadId, ids)))
    : [];
  const pollRows = await db.select({ threadId: polls.threadId }).from(polls).where(inArray(polls.threadId, ids));
  const sums = await getSummaries([...rows.map((r) => r.t.authorId), ...lasts.map((l) => l.authorId)], viewer);
  const weekAgo = Date.now() - 7 * 86400_000;
  return rows.map(({ t, catName, catSlug }) => {
    const first = firsts.find((f) => f.threadId === t.id);
    const last = lasts.find((l) => l.threadId === t.id);
    const thumb = first ? thumbs.find((x) => x.postId === first.id) : null;
    const read = reads.find((r) => r.id === t.id);
    const guestLocked = !viewer && (thumb?.blur || adult.get(t.categoryId));
    return {
      id: t.id,
      title: t.title,
      prefix: t.prefix,
      tags: t.tags,
      pinned: t.pinned,
      locked: t.locked,
      solved: t.solved,
      replyCount: t.replyCount,
      viewCount: t.viewCount,
      lastPostAt: t.lastPostAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      category: { name: catName, slug: catSlug },
      author: toAuthor(sums.get(t.authorId)),
      excerpt: first ? excerptOf(first.body) : "",
      thumbUrl: thumb ? mediaUrl(thumb.id, guestLocked ? "b" : "t") : null,
      lastReply: last && last.id !== first?.id ? { author: toAuthor(sums.get(last.authorId)), at: last.at.toISOString() } : null,
      unread: Boolean(viewer) && (read ? t.lastPostAt > read.at : t.lastPostAt.getTime() > weekAgo),
      hasPoll: pollRows.some((p) => p.threadId === t.id),
    };
  });
}

export async function getThread(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [t] = await db.select().from(forumThreads).where(eq(forumThreads.id, id));
  return t ?? null;
}

/** Sichtbare Beiträge eines Themas (chronologisch, seitenweise). */
export function threadPostsWhere(threadId: string, viewer: SessionUser | null, countries: string[]) {
  return and(eq(posts.threadId, threadId), isNull(posts.deletedAt), eq(posts.isDraft, false), visibleToSql(posts.authorId, viewer?.id ?? null, countries));
}

export async function threadPostPage(threadId: string, viewer: SessionUser | null, countries: string[], page: number) {
  const where = threadPostsWhere(threadId, viewer, countries);
  const [{ n }] = await db.select({ n: count() }).from(posts).where(where);
  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(asc(posts.createdAt), asc(posts.id))
    .limit(POSTS_PER_PAGE)
    .offset((page - 1) * POSTS_PER_PAGE);
  return { rows, total: n };
}

/** Position eines Beitrags (für ?beitrag= und "Zum ersten ungelesenen Beitrag"). */
export async function pageOfPost(threadId: string, viewer: SessionUser | null, countries: string[], at: Date) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(threadPostsWhere(threadId, viewer, countries), sql`${posts.createdAt} < ${at.toISOString()}`));
  return Math.floor(n / POSTS_PER_PAGE) + 1;
}

export async function firstUnread(threadId: string, viewer: SessionUser, countries: string[]) {
  const [r] = await db.select({ at: forumReads.lastReadAt }).from(forumReads).where(and(eq(forumReads.userId, viewer.id), eq(forumReads.threadId, threadId)));
  if (!r) return null;
  const [p] = await db
    .select({ id: posts.id, at: posts.createdAt })
    .from(posts)
    .where(and(threadPostsWhere(threadId, viewer, countries), sql`${posts.createdAt} > ${r.at.toISOString()}`, ne(posts.authorId, viewer.id)))
    .orderBy(asc(posts.createdAt))
    .limit(1);
  return p ? { id: p.id, page: await pageOfPost(threadId, viewer, countries, p.at) } : null;
}

export async function markRead(threadId: string, userId: string, at: Date) {
  await db
    .insert(forumReads)
    .values({ userId, threadId, lastReadAt: at })
    .onConflictDoUpdate({ target: [forumReads.userId, forumReads.threadId], set: { lastReadAt: sql`GREATEST(${forumReads.lastReadAt}, ${at.toISOString()}::timestamptz)` } });
}

export async function pollFor(threadId: string, viewerId: string | null): Promise<PollView | null> {
  const [p] = await db.select().from(polls).where(eq(polls.threadId, threadId)).limit(1);
  if (!p) return null;
  const opts = await db.select().from(pollOptions).where(eq(pollOptions.pollId, p.id)).orderBy(asc(pollOptions.sortOrder));
  const votes = opts.length
    ? await db
        .select({ optionId: pollVotes.optionId, n: count() })
        .from(pollVotes)
        .where(inArray(pollVotes.optionId, opts.map((o) => o.id)))
        .groupBy(pollVotes.optionId)
    : [];
  const mine = viewerId && opts.length
    ? await db
        .select({ id: pollVotes.optionId })
        .from(pollVotes)
        .where(and(eq(pollVotes.userId, viewerId), inArray(pollVotes.optionId, opts.map((o) => o.id))))
    : [];
  const [{ voters }] = opts.length
    ? await db
        .select({ voters: sql<number>`count(DISTINCT ${pollVotes.userId})`.mapWith(Number) })
        .from(pollVotes)
        .where(inArray(pollVotes.optionId, opts.map((o) => o.id)))
    : [{ voters: 0 }];
  const options = opts.map((o) => ({ id: o.id, label: o.label, votes: votes.find((v) => v.optionId === o.id)?.n ?? 0 }));
  return {
    id: p.id,
    question: p.question,
    multiple: p.multiple,
    closesAt: p.closesAt?.toISOString() ?? null,
    closed: Boolean(p.closesAt && p.closesAt.getTime() < Date.now()),
    total: options.reduce((a, o) => a + o.votes, 0),
    voters,
    mine: mine.map((m) => m.id),
    options,
  };
}

/** "Mehr zu": ähnliche Themen (Titel-Ähnlichkeit per Trigramm, gleiche Tags, gleiche Kategorie). */
export async function relatedThreads(t: typeof forumThreads.$inferSelect, readable: string[], viewer: SessionUser | null, countries: string[]): Promise<RelatedThread[]> {
  if (!readable.length) return [];
  const score = sql<number>`(similarity(${forumThreads.title}, ${t.title}) * 3
    + CASE WHEN ${forumThreads.tags} && ${t.tags.length ? sql`ARRAY[${sql.join(t.tags.map((x) => sql`${x}`), sql`, `)}]::text[]` : sql`'{}'::text[]`} THEN 1 ELSE 0 END
    + CASE WHEN ${forumThreads.categoryId} = ${t.categoryId} THEN 0.3 ELSE 0 END)`;
  const rows = await db
    .select({ id: forumThreads.id, title: forumThreads.title, replyCount: forumThreads.replyCount, lastPostAt: forumThreads.lastPostAt, category: forumCategories.name, score })
    .from(forumThreads)
    .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
    .where(and(ne(forumThreads.id, t.id), inArray(forumThreads.categoryId, readable), visibleToSql(forumThreads.authorId, viewer?.id ?? null, countries)))
    .orderBy(desc(score), desc(forumThreads.lastPostAt))
    .limit(5);
  return rows.map((r) => ({ id: r.id, title: r.title, replyCount: r.replyCount, lastPostAt: r.lastPostAt.toISOString(), category: r.category }));
}

export async function isSubscribed(threadId: string, userId: string | null | undefined) {
  if (!userId) return false;
  const rows = await db.execute(sql`SELECT 1 FROM forum_subscriptions WHERE user_id = ${userId} AND thread_id = ${threadId}`);
  return rows.rows.length > 0;
}
