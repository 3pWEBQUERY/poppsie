import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { forumCategories, forumCategoryModerators, groups } from "@/db/schema";
import { isStaff } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { canModerateGroup, canPostInGroup, canReadGroup, getMembership, membershipsFor } from "@/lib/groups/access";

export type Category = typeof forumCategories.$inferSelect;

export async function allCategories(): Promise<Category[]> {
  return db.select().from(forumCategories).orderBy(asc(forumCategories.sortOrder), asc(forumCategories.name));
}

export async function categoryById(id: string) {
  const [c] = await db.select().from(forumCategories).where(eq(forumCategories.id, id));
  return c ?? null;
}

export async function categoryBySlug(slug: string) {
  const [c] = await db.select().from(forumCategories).where(eq(forumCategories.slug, slug));
  return c ?? null;
}

/** Unterforen erben Rechte der Oberkategorie, solange sie selbst keine festlegen. */
function effective(cat: Category, parent: Category | null, key: "readTypes" | "writeTypes") {
  return cat[key].length ? cat[key] : (parent?.[key] ?? []);
}

async function parentOf(cat: Category) {
  return cat.parentId ? categoryById(cat.parentId) : null;
}

export async function canReadCategory(viewer: SessionUser | null, cat: Category, parent?: Category | null) {
  if (isStaff(viewer)) return true;
  if (cat.groupId) {
    const [g] = await db.select({ privacy: groups.privacy }).from(groups).where(eq(groups.id, cat.groupId));
    if (!g) return false;
    return canReadGroup(viewer, g, await getMembership(cat.groupId, viewer?.id));
  }
  const types = effective(cat, parent === undefined ? await parentOf(cat) : parent, "readTypes");
  if (!types.length) return true;
  return Boolean(viewer && types.includes(viewer.accountType));
}

export async function canWriteCategory(viewer: SessionUser | null, cat: Category, parent?: Category | null) {
  if (!viewer) return false;
  if (isStaff(viewer)) return true;
  if (cat.groupId) return canPostInGroup(await getMembership(cat.groupId, viewer.id));
  const p = parent === undefined ? await parentOf(cat) : parent;
  if (!(await canReadCategory(viewer, cat, p))) return false;
  const types = effective(cat, p, "writeTypes");
  return !types.length || types.includes(viewer.accountType);
}

/** Staff, Moderatoren der Kategorie bzw. Oberkategorie, oder Gruppen-Moderatoren im Gruppen-Forum. */
export async function isCategoryModerator(viewer: SessionUser | null, cat: Category) {
  if (!viewer) return false;
  if (isStaff(viewer)) return true;
  if (cat.groupId) return canModerateGroup(viewer, await getMembership(cat.groupId, viewer.id));
  const ids = [cat.id, cat.parentId].filter(Boolean) as string[];
  const rows = await db
    .select({ x: forumCategoryModerators.userId })
    .from(forumCategoryModerators)
    .where(and(eq(forumCategoryModerators.userId, viewer.id), inArray(forumCategoryModerators.categoryId, ids)))
    .limit(1);
  return rows.length > 0;
}

/** IDs aller Kategorien, die der Betrachter lesen darf (für Listen und Suche). */
export async function readableCategoryIds(viewer: SessionUser | null, opts: { includeGroups?: boolean } = {}) {
  const cats = await allCategories();
  const byId = new Map(cats.map((c) => [c.id, c]));
  const groupCats = cats.filter((c) => c.groupId);
  const out: string[] = [];
  for (const c of cats) {
    if (c.groupId) continue;
    if (isStaff(viewer)) {
      out.push(c.id);
      continue;
    }
    const types = effective(c, c.parentId ? (byId.get(c.parentId) ?? null) : null, "readTypes");
    if (!types.length || (viewer && types.includes(viewer.accountType))) out.push(c.id);
  }
  if (opts.includeGroups && groupCats.length) {
    const gids = groupCats.map((c) => c.groupId!);
    const gs = await db.select({ id: groups.id, privacy: groups.privacy }).from(groups).where(inArray(groups.id, gids));
    const mem = await membershipsFor(viewer?.id, gids);
    const ok = new Set(gs.filter((g) => canReadGroup(viewer, g, mem.get(g.id) ?? null)).map((g) => g.id));
    for (const c of groupCats) if (ok.has(c.groupId!)) out.push(c.id);
  }
  return out;
}

/** Kategorien, in denen der Benutzer moderiert (für "Verschieben"). */
export async function moderatedCategoryIds(userId: string) {
  const rows = await db.select({ id: forumCategoryModerators.categoryId }).from(forumCategoryModerators).where(eq(forumCategoryModerators.userId, userId));
  return rows.map((r) => r.id);
}

/** Forum-Kategorie einer Gruppe. */
export async function groupCategory(groupId: string) {
  const [c] = await db
    .select()
    .from(forumCategories)
    .where(and(eq(forumCategories.groupId, groupId), isNotNull(forumCategories.groupId)))
    .limit(1);
  return c ?? null;
}

