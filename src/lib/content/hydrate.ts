import "server-only";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { escortProfiles, posts, reactions, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/guards";
import { getSummaries, type UserSummary } from "@/lib/users/summary";
import { embedKey, resolveEmbeds } from "./embeds";
import { mediaForPosts, mediaView } from "./media";
import type { Author, EmbedRef, PostView, QuoteView, ReactionKind, ReactionSummary, ReactionTarget } from "./types";

export type PostRow = typeof posts.$inferSelect;

const GONE: Author = { id: "", username: "", name: "Gelöschtes Profil", accountType: "member", avatarUrl: null, verified: false, href: "#" };

export function toAuthor(s: UserSummary | undefined): Author {
  if (!s) return GONE;
  return { id: s.id, username: s.username, name: s.name, accountType: s.accountType, avatarUrl: s.avatarUrl, verified: s.verified, href: s.href, online: s.online };
}

/** Reaktionen gruppiert nach Ziel und Art, plus eigene Reaktion. */
export async function reactionSummaries(targetType: ReactionTarget, ids: string[], viewerId: string | null) {
  const map = new Map<string, ReactionSummary>();
  for (const id of ids) map.set(id, { counts: {}, total: 0, mine: null });
  if (!ids.length) return map;
  const rows = await db
    .select({ id: reactions.targetId, kind: reactions.kind, n: count() })
    .from(reactions)
    .where(and(eq(reactions.targetType, targetType), inArray(reactions.targetId, ids)))
    .groupBy(reactions.targetId, reactions.kind);
  for (const r of rows) {
    const s = map.get(r.id)!;
    s.counts[r.kind as ReactionKind] = r.n;
    s.total += r.n;
  }
  if (viewerId) {
    const mine = await db
      .select({ id: reactions.targetId, kind: reactions.kind })
      .from(reactions)
      .where(and(eq(reactions.targetType, targetType), inArray(reactions.targetId, ids), eq(reactions.userId, viewerId)));
    for (const m of mine) map.get(m.id)!.mine = m.kind as ReactionKind;
  }
  return map;
}

export function postHref(p: Pick<PostRow, "id" | "context" | "threadId">) {
  if (p.context === "forum" && p.threadId) return `/forum/thread/${p.threadId}?beitrag=${p.id}`;
  return `/feed/${p.id}`;
}

type Opts = {
  countries: string[];
  /** Forum-Kategorie mit Erwachsenen-Medien: Gäste sehen nur unkenntliche Medien. */
  adultOnly?: boolean;
  /** Moderator des Kontexts (Gruppe/Kategorie): darf fremde Beiträge löschen. */
  moderator?: boolean;
  /** Forum: Beitragszahl und Geschlecht der Autoren. */
  authorStats?: boolean;
};

/** Datenbank-Zeilen in Ansichten für das Content-Modul umwandeln (ein Satz Abfragen pro Seite). */
export async function hydratePosts(rows: PostRow[], viewer: SessionUser | null, opts: Opts): Promise<PostView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const quoteIds = rows.map((r) => r.quoteId).filter(Boolean) as string[];
  const quoted = quoteIds.length
    ? await db.select({ id: posts.id, authorId: posts.authorId, body: posts.body, deletedAt: posts.deletedAt }).from(posts).where(inArray(posts.id, quoteIds))
    : [];
  const [sums, mediaMap, reacts] = await Promise.all([
    getSummaries([...rows.map((r) => r.authorId), ...quoted.map((q) => q.authorId)], viewer),
    mediaForPosts(ids),
    reactionSummaries("post", ids, viewer?.id ?? null),
  ]);
  const refs: EmbedRef[] = rows.flatMap((r) => r.embeds ?? []);
  const embeds = refs.length ? await resolveEmbeds(refs, viewer, opts.countries) : new Map();

  let stats = new Map<string, { posts: number; gender: string | null }>();
  if (opts.authorStats) {
    const authorIds = [...new Set(rows.map((r) => r.authorId))];
    const counts = await db
      .select({ id: posts.authorId, n: count() })
      .from(posts)
      .where(and(inArray(posts.authorId, authorIds), eq(posts.context, "forum"), sql`${posts.deletedAt} IS NULL`))
      .groupBy(posts.authorId);
    const genders = await db
      .select({ id: users.id, gender: escortProfiles.gender })
      .from(users)
      .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
      .where(inArray(users.id, authorIds));
    const g = new Map(genders.map((x) => [x.id, x.gender]));
    stats = new Map(authorIds.map((id) => [id, { posts: counts.find((c) => c.id === id)?.n ?? 0, gender: g.get(id) ?? null }]));
  }

  const guest = !viewer;
  return rows.map((r) => {
    const q = r.quoteId ? quoted.find((x) => x.id === r.quoteId) : null;
    const quote: QuoteView | null = q
      ? {
          id: q.id,
          author: sums.get(q.authorId) ? { name: sums.get(q.authorId)!.name, href: sums.get(q.authorId)!.href } : null,
          excerpt: q.deletedAt ? "" : q.body.slice(0, 400),
          deleted: Boolean(q.deletedAt),
        }
      : null;
    const own = viewer?.id === r.authorId;
    return {
      id: r.id,
      context: r.context,
      groupId: r.groupId,
      threadId: r.threadId,
      author: toAuthor(sums.get(r.authorId)),
      body: r.body,
      visibility: r.visibility,
      media: (mediaMap.get(r.id) ?? []).map((m) => mediaView(m, { guest, adultOnly: opts.adultOnly })),
      embeds: (r.embeds ?? []).map((e) => embeds.get(embedKey(e))).filter(Boolean),
      quote,
      reactions: reacts.get(r.id)!,
      commentCount: r.commentCount,
      approved: r.approved,
      editedAt: r.editedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      href: postHref(r),
      canEdit: own,
      canDelete: own || Boolean(opts.moderator) || isStaff(viewer),
      authorPosts: stats.get(r.authorId)?.posts,
      authorGender: stats.get(r.authorId)?.gender ?? null,
    };
  });
}

