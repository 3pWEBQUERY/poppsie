import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { isStaff } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media/urls";
import { getSummaries } from "@/lib/users/summary";
import { visibleToSql } from "@/lib/visibility";
import { membershipsFor, type Group } from "./access";
import type { GroupCardView, GroupMemberView } from "./types";

export async function toCards(rows: Group[], viewer: SessionUser | null): Promise<GroupCardView[]> {
  const mem = await membershipsFor(
    viewer?.id,
    rows.map((r) => r.id),
  );
  return rows.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    coverUrl: g.coverMediaId ? mediaUrl(g.coverMediaId, "t") : null,
    privacy: g.privacy,
    memberCount: g.memberCount,
    region: g.region,
    myStatus: mem.get(g.id)?.status ?? null,
    myRole: mem.get(g.id)?.role ?? null,
  }));
}

/** Sichtbare Gruppen: geheime nur für Mitglieder/Eingeladene; gesperrte Mitglieder sehen die Gruppe nicht. */
function discoverableSql(viewer: SessionUser | null, includeSecret: boolean): SQL | undefined {
  if (isStaff(viewer) && includeSecret) return undefined;
  const vid = viewer?.id ?? null;
  const parts: SQL[] = [];
  if (vid) parts.push(sql`NOT EXISTS (SELECT 1 FROM group_members b WHERE b.group_id = ${groups.id} AND b.user_id = ${vid} AND b.status = 'banned')`);
  if (includeSecret && vid) {
    parts.push(
      sql`(${groups.privacy} <> 'secret' OR EXISTS (SELECT 1 FROM group_members s WHERE s.group_id = ${groups.id} AND s.user_id = ${vid} AND s.status IN ('active', 'invited')))`,
    );
  } else parts.push(ne(groups.privacy, "secret"));
  return and(...parts);
}

/** Gruppensuche (Name/Beschreibung), geheime Gruppen erscheinen nie in der Suche. */
export async function searchGroups(viewer: SessionUser | null, opts: { q?: string | null; region?: string | null; page?: number; perPage?: number }) {
  const per = opts.perPage ?? 24;
  const q = opts.q?.trim().slice(0, 80);
  const where = and(
    discoverableSql(viewer, false),
    visibleToSql(groups.ownerId, viewer?.id ?? null, [], { requireKyc: false }),
    q ? or(ilike(groups.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(groups.description, `%${q.replace(/[%_\\]/g, "\\$&")}%`)) : undefined,
    opts.region ? eq(groups.region, opts.region) : undefined,
  );
  const [{ n }] = await db.select({ n: count() }).from(groups).where(where);
  const rows = await db
    .select()
    .from(groups)
    .where(where)
    .orderBy(desc(groups.memberCount), desc(groups.createdAt))
    .limit(per)
    .offset(((opts.page ?? 1) - 1) * per);
  return { items: await toCards(rows, viewer), total: n };
}

/** Vorschläge "Gruppen in deiner Region" (ohne Gruppen, in denen man schon ist). */
export async function regionSuggestions(viewer: SessionUser, limit = 6) {
  if (!viewer.region) return [];
  const rows = await db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.region, viewer.region),
        discoverableSql(viewer, false),
        sql`NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = ${groups.id} AND m.user_id = ${viewer.id})`,
      ),
    )
    .orderBy(desc(groups.memberCount))
    .limit(limit);
  return toCards(rows, viewer);
}

export async function myGroups(viewer: SessionUser) {
  const rows = await db
    .select({ g: groups })
    .from(groups)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, viewer.id)))
    .where(inArray(groupMembers.status, ["active", "pending", "invited"]))
    .orderBy(asc(groups.name))
    .limit(100);
  return toCards(
    rows.map((r) => r.g),
    viewer,
  );
}

export async function groupMemberList(groupId: string, viewer: SessionUser | null, statuses: GroupMemberView["status"][], limit = 200): Promise<GroupMemberView[]> {
  const rows = await db
    .select({ userId: groupMembers.userId, role: groupMembers.role, status: groupMembers.status, since: groupMembers.createdAt })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.status, statuses), visibleToSql(groupMembers.userId, viewer?.id ?? null, [], { requireKyc: false })))
    .orderBy(sql`CASE ${groupMembers.role} WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END`, asc(groupMembers.createdAt))
    .limit(limit);
  const sums = await getSummaries(
    rows.map((r) => r.userId),
    viewer,
  );
  return rows
    .filter((r) => sums.has(r.userId))
    .map((r) => {
      const s = sums.get(r.userId)!;
      return { userId: r.userId, name: s.name, username: s.username, avatarUrl: s.avatarUrl, href: s.href, verified: s.verified, accountType: s.accountType, role: r.role, status: r.status, since: r.since.toISOString() };
    });
}

export async function pendingCounts(groupId: string) {
  const [req] = await db.select({ n: count() }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "pending")));
  const [p] = (
    await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM posts WHERE group_id = ${groupId} AND NOT approved AND NOT is_draft AND deleted_at IS NULL`)
  ).rows;
  return { requests: req?.n ?? 0, posts: p?.n ?? 0 };
}

export async function recountMembers(groupId: string) {
  await db.execute(sql`UPDATE groups SET member_count = (SELECT count(*) FROM group_members WHERE group_id = ${groupId} AND status = 'active') WHERE id = ${groupId}`);
}
