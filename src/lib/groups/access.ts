import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { isStaff } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";

export type Group = typeof groups.$inferSelect;
export type GroupRole = (typeof groupMembers.$inferSelect)["role"];
export type Membership = { role: GroupRole; status: (typeof groupMembers.$inferSelect)["status"] } | null;

const RANK: Record<GroupRole, number> = { member: 1, moderator: 2, admin: 3, owner: 4 };
export const roleRank = (r: GroupRole) => RANK[r];

export const ROLE_LABELS: Record<GroupRole, string> = { owner: "Inhaber", admin: "Admin", moderator: "Moderator", member: "Mitglied" };

export async function getMembership(groupId: string, userId: string | null | undefined): Promise<Membership> {
  if (!userId) return null;
  const [m] = await db
    .select({ role: groupMembers.role, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return m ?? null;
}

export async function membershipsFor(userId: string | null | undefined, groupIds: string[]) {
  const map = new Map<string, NonNullable<Membership>>();
  if (!userId || !groupIds.length) return map;
  const rows = await db
    .select({ groupId: groupMembers.groupId, role: groupMembers.role, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), inArray(groupMembers.groupId, [...new Set(groupIds)])));
  for (const r of rows) map.set(r.groupId, { role: r.role, status: r.status });
  return map;
}

export const isActive = (m: Membership) => m?.status === "active";

/** Gruppe überhaupt sichtbar? Geheime Gruppen nur für Mitglieder und Eingeladene. */
export function canSeeGroup(viewer: SessionUser | null, g: Pick<Group, "privacy">, m: Membership) {
  if (isStaff(viewer)) return true;
  if (m?.status === "banned") return false;
  if (g.privacy === "secret") return m?.status === "active" || m?.status === "invited";
  return true;
}

/** Feed und Forum lesen: öffentliche Gruppen für alle, sonst nur aktive Mitglieder. */
export function canReadGroup(viewer: SessionUser | null, g: Pick<Group, "privacy">, m: Membership) {
  if (isStaff(viewer)) return true;
  if (m?.status === "banned") return false;
  if (g.privacy === "public") return true;
  return isActive(m);
}

export const canPostInGroup = (m: Membership) => isActive(m);

export function canModerateGroup(viewer: SessionUser | null, m: Membership) {
  if (isStaff(viewer)) return true;
  return isActive(m) && roleRank(m!.role) >= RANK.moderator;
}

export function canAdminGroup(viewer: SessionUser | null, m: Membership) {
  if (isStaff(viewer)) return true;
  return isActive(m) && roleRank(m!.role) >= RANK.admin;
}

export async function groupBySlug(slug: string) {
  const [g] = await db.select().from(groups).where(eq(groups.slug, slug));
  return g ?? null;
}

export async function groupById(id: string) {
  const [g] = await db.select().from(groups).where(eq(groups.id, id));
  return g ?? null;
}
