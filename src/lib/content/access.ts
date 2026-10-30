import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows, forumThreads, groups, posts } from "@/db/schema";
import { isStaff } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { canReadCategory, canWriteCategory, categoryById, isCategoryModerator } from "@/lib/forum/access";
import { canModerateGroup, canPostInGroup, canReadGroup, getMembership } from "@/lib/groups/access";
import { visibleToSql } from "@/lib/visibility";

export type PostAccess = {
  canView: boolean;
  /** Darf kommentieren und reagieren. */
  canInteract: boolean;
  moderator: boolean;
  adultOnly: boolean;
  locked: boolean;
};

const NONE: PostAccess = { canView: false, canInteract: false, moderator: false, adultOnly: false, locked: false };

export async function getPost(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db.select().from(posts).where(eq(posts.id, id));
  return p ?? null;
}

/** Zentrale Prüfung, ob ein Betrachter einen Beitrag sehen bzw. darauf reagieren darf. */
export async function postAccess(viewer: SessionUser | null, p: typeof posts.$inferSelect, countries: string[]): Promise<PostAccess> {
  const own = viewer?.id === p.authorId;
  if (p.deletedAt || (p.isDraft && !own)) return NONE;
  if (!own && !isStaff(viewer)) {
    const [v] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, p.id), visibleToSql(posts.authorId, viewer?.id ?? null, countries)));
    if (!v) return NONE;
  }

  if (p.context === "feed") {
    let ok = own || isStaff(viewer) || p.visibility === "public" || (p.visibility === "members" && Boolean(viewer));
    if (!ok && viewer && p.visibility === "followers") {
      const [f] = await db
        .select({ x: follows.followerId })
        .from(follows)
        .where(and(eq(follows.followerId, viewer.id), eq(follows.followeeId, p.authorId)));
      ok = Boolean(f);
    }
    return { canView: ok, canInteract: ok && Boolean(viewer), moderator: isStaff(viewer), adultOnly: false, locked: false };
  }

  if (p.context === "group" && p.groupId) {
    const [g] = await db.select({ privacy: groups.privacy }).from(groups).where(eq(groups.id, p.groupId));
    if (!g) return NONE;
    const m = await getMembership(p.groupId, viewer?.id);
    const moderator = canModerateGroup(viewer, m);
    if (!canReadGroup(viewer, g, m)) return NONE;
    if (!p.approved && !own && !moderator) return NONE;
    return { canView: true, canInteract: canPostInGroup(m) && p.approved, moderator, adultOnly: false, locked: false };
  }

  if (p.context === "forum" && p.threadId) {
    const [t] = await db.select({ categoryId: forumThreads.categoryId, locked: forumThreads.locked }).from(forumThreads).where(eq(forumThreads.id, p.threadId));
    if (!t) return NONE;
    const cat = await categoryById(t.categoryId);
    if (!cat || !(await canReadCategory(viewer, cat))) return NONE;
    const moderator = await isCategoryModerator(viewer, cat);
    const write = await canWriteCategory(viewer, cat);
    return { canView: true, canInteract: write && (!t.locked || moderator), moderator, adultOnly: cat.adultOnlyMedia, locked: t.locked };
  }
  return NONE;
}

