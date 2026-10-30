import "server-only";
import { and, count, desc, eq, getTableColumns, gt, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { hydratePosts } from "./hydrate";
import type { PostView } from "./types";
import { approvedSql, audienceSql, livePostSql } from "./visibility";

export type FeedTab = "fuer-dich" | "neueste";
export type FeedScope = { kind: "feed"; tab: FeedTab; tag?: string | null } | { kind: "group"; groupId: string; moderator?: boolean };
export type FeedPage = { posts: PostView[]; nextCursor: string | null; asOf: string };

const PAGE = 10;

type Cursor = { a: string; s?: number; t?: string; id: string };

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decode(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    if (typeof c.id !== "string" || !/^[0-9a-f-]{36}$/i.test(c.id) || Number.isNaN(Date.parse(c.a))) return null;
    return c;
  } catch {
    return null;
  }
}

export function cleanTag(tag: string | null | undefined) {
  const t = tag?.trim().replace(/^#/, "").toLowerCase();
  return t && /^[\p{L}0-9_]{2,40}$/u.test(t) ? t : null;
}

function scopeSql(scope: FeedScope, viewer: SessionUser | null): SQL {
  const vid = viewer?.id ?? null;
  if (scope.kind === "group") return and(eq(posts.context, "group"), eq(posts.groupId, scope.groupId), approvedSql(vid))!;
  const parts: SQL[] = [eq(posts.context, "feed"), eq(posts.approved, true), audienceSql(vid)];
  const tag = cleanTag(scope.tag);
  if (tag) parts.push(sql`${tag} = ANY(${posts.hashtags})`);
  return and(...parts)!;
}

/**
 * "Für dich": Aktualität gewichtet mit Folgen, Favoriten, bisherigen Interaktionen mit dem Autor,
 * gleicher Region und Engagement. Stabil seitenweise über einen festen Zeitpunkt (asOf) im Cursor.
 */
function scoreSql(viewer: SessionUser | null, asOf: string): SQL<number> {
  const vid = viewer?.id ?? null;
  const age = sql`GREATEST(EXTRACT(EPOCH FROM (${asOf}::timestamptz - ${posts.createdAt})) / 3600.0, 0)`;
  const engagement = sql`0.5 * LN(1 + ${posts.reactionCount} + 2 * ${posts.commentCount})`;
  if (!vid) return sql<number>`((1 + ${engagement}) / POWER(${age} + 2, 1.3))::float8`;
  const followed = sql`(CASE WHEN EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${vid} AND f.followee_id = ${posts.authorId}) THEN 3 ELSE 0 END)`;
  const fav = sql`(CASE WHEN EXISTS (SELECT 1 FROM favorites fv WHERE fv.user_id = ${vid} AND fv.target_id = ${posts.authorId}) THEN 3 ELSE 0 END)`;
  const interacted = sql`(CASE WHEN EXISTS (SELECT 1 FROM reactions r JOIN posts p2 ON p2.id = r.target_id
      WHERE r.target_type = 'post' AND r.user_id = ${vid} AND p2.author_id = ${posts.authorId} AND r.created_at > ${asOf}::timestamptz - interval '30 days')
    OR EXISTS (SELECT 1 FROM comments c JOIN posts p3 ON p3.id = c.post_id
      WHERE c.author_id = ${vid} AND p3.author_id = ${posts.authorId} AND c.created_at > ${asOf}::timestamptz - interval '30 days') THEN 2 ELSE 0 END)`;
  const region = viewer?.region
    ? sql`(CASE WHEN EXISTS (SELECT 1 FROM users ru WHERE ru.id = ${posts.authorId} AND ru.region = ${viewer.region}) THEN 1 ELSE 0 END)`
    : sql`0`;
  const own = sql`(CASE WHEN ${posts.authorId} = ${vid} THEN 1 ELSE 0 END)`;
  return sql<number>`((1 + ${followed} + ${fav} + ${interacted} + ${region} + ${own} + ${engagement}) / POWER(${age} + 2, 1.3))::float8`;
}

/** Eine Seite Beiträge (Feed oder Gruppe) mit Cursor-Pagination. */
export async function feedPage(viewer: SessionUser | null, countries: string[], scope: FeedScope, cursorRaw?: string | null, limit = PAGE): Promise<FeedPage> {
  const cursor = decode(cursorRaw);
  const asOf = cursor?.a ?? new Date().toISOString();
  const base = and(livePostSql(viewer?.id ?? null, countries), scopeSql(scope, viewer), sql`${posts.createdAt} <= ${asOf}::timestamptz`);
  const ranked = scope.kind === "feed" && scope.tab === "fuer-dich";
  let rows: (typeof posts.$inferSelect & { s?: number })[];
  if (ranked) {
    const score = scoreSql(viewer, asOf);
    rows = await db
      .select({ ...getTableColumns(posts), s: score })
      .from(posts)
      .where(
        and(
          base,
          sql`${posts.createdAt} > ${asOf}::timestamptz - interval '60 days'`,
          cursor?.s !== undefined ? sql`(${score}, ${posts.id}) < (${cursor.s}::float8, ${cursor.id}::uuid)` : undefined,
        ),
      )
      .orderBy(desc(score), desc(posts.id))
      .limit(limit + 1);
  } else {
    rows = await db
      .select()
      .from(posts)
      .where(and(base, cursor?.t ? sql`(${posts.createdAt}, ${posts.id}) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : undefined))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(limit + 1);
  }
  const more = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  const nextCursor = more && last ? encode(ranked ? { a: asOf, s: Number(last.s), id: last.id } : { a: asOf, t: last.createdAt.toISOString(), id: last.id }) : null;
  const views = await hydratePosts(pageRows, viewer, { countries, moderator: scope.kind === "group" ? scope.moderator : false });
  return { posts: views, nextCursor, asOf };
}

/** Anzahl neuer Beiträge seit dem Laden (für die Pill "X neue Beiträge"). */
export async function countNewer(viewer: SessionUser | null, countries: string[], scope: FeedScope, since: string) {
  if (Number.isNaN(Date.parse(since))) return 0;
  const [{ n }] = await db
    .select({ n: count() })
    .from(posts)
    .where(
      and(
        livePostSql(viewer?.id ?? null, countries),
        scopeSql(scope, viewer),
        gt(posts.createdAt, new Date(since)),
        viewer ? ne(posts.authorId, viewer.id) : undefined,
      ),
    );
  return n;
}

/** Beliebte Hashtags der letzten 7 Tage (öffentliche Feed-Beiträge). */
export async function trendingTags(limit = 10) {
  const res = await db.execute<{ tag: string; n: number }>(sql`
    SELECT t AS tag, count(*)::int AS n FROM posts, unnest(hashtags) t
    WHERE context = 'feed' AND visibility = 'public' AND approved AND NOT is_draft AND deleted_at IS NULL AND created_at > now() - interval '7 days'
    GROUP BY t ORDER BY n DESC, t LIMIT ${limit}`);
  return res.rows;
}
