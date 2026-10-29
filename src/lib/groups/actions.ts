"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { forumCategories, groupMembers, groups, media, posts, users } from "@/db/schema";
import { ApiError, isStaff, requireUser, run } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { notify, notifyMany } from "@/lib/notify";
import { limitOrThrow, writeLimit } from "@/lib/rate-limit";
import { getSummary } from "@/lib/users/summary";
import { slugify } from "@/lib/utils";
import { isBlockedBetween } from "@/lib/visibility";
import { notifyMentions } from "@/lib/content/write";
import { canAdminGroup, canModerateGroup, getMembership, groupById, roleRank, type Group, type Membership } from "./access";
import { recountMembers } from "./queries";

const GroupInput = z.object({
  name: z.string().trim().min(3, "Der Name ist zu kurz").max(80, "Der Name ist zu lang"),
  description: z.string().trim().max(2000).nullish(),
  rules: z.string().trim().max(4000).nullish(),
  privacy: z.enum(["public", "private", "secret"]),
  coverMediaId: z.uuid().nullish(),
  region: z.string().trim().max(4).nullish(),
  requirePostApproval: z.boolean().default(false),
});

async function assertCover(userId: string, id: string | null | undefined) {
  if (!id) return;
  const [m] = await db.select({ owner: media.ownerId, kind: media.kind }).from(media).where(eq(media.id, id));
  if (!m || m.owner !== userId || m.kind !== "image") throw new ApiError("INVALID", "Ungültiges Titelbild");
}

/** Gruppe erstellen: Inhaber-Mitgliedschaft und eigenes Gruppen-Forum (Forum-Kategorie mit group_id). */
export async function createGroup(input: z.input<typeof GroupInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = GroupInput.parse(input);
    await limitOrThrow(`group-create:${user.id}`, 5, 86400, "Du kannst höchstens 5 Gruppen pro Tag erstellen.");
    await assertCover(user.id, data.coverMediaId);
    const base = slugify(data.name) || "gruppe";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const [hit] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, slug));
      if (!hit && slug !== "neu") break;
      slug = `${base}-${i}`;
    }
    const [g] = await db
      .insert(groups)
      .values({ ...data, description: data.description || null, rules: data.rules || null, region: data.region || null, coverMediaId: data.coverMediaId ?? null, slug, ownerId: user.id })
      .returning();
    await db.insert(groupMembers).values({ groupId: g!.id, userId: user.id, role: "owner", status: "active" });
    await db
      .insert(forumCategories)
      .values({ slug: `gruppe-${g!.slug}`, name: `Forum: ${g!.name}`, groupId: g!.id, description: `Gruppen-Forum von ${g!.name}` })
      .onConflictDoNothing();
    return { slug: g!.slug };
  });
}

async function loadAdmin(user: SessionUser, groupId: string, level: "moderator" | "admin" | "owner" = "admin") {
  const g = await groupById(groupId);
  if (!g) throw new ApiError("NOT_FOUND");
  const m = await getMembership(g.id, user.id);
  const ok =
    level === "owner" ? isStaff(user) || (m?.status === "active" && m.role === "owner") : level === "admin" ? canAdminGroup(user, m) : canModerateGroup(user, m);
  if (!ok) throw new ApiError("FORBIDDEN", "Keine Berechtigung");
  return { g, m };
}

export async function updateGroup(input: z.input<typeof GroupInput> & { groupId: string }) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const groupId = z.uuid().parse(input.groupId);
    const data = GroupInput.parse(input);
    await writeLimit(user.id, "group-edit", 20);
    const { g } = await loadAdmin(user, groupId, "admin");
    await assertCover(user.id, data.coverMediaId && data.coverMediaId !== g.coverMediaId ? data.coverMediaId : null);
    await db
      .update(groups)
      .set({ ...data, description: data.description || null, rules: data.rules || null, region: data.region || null, coverMediaId: data.coverMediaId ?? null })
      .where(eq(groups.id, g.id));
    await db.update(forumCategories).set({ name: `Forum: ${data.name}` }).where(eq(forumCategories.groupId, g.id));
    revalidatePath(`/gruppen/${g.slug}`, "layout");
    return { slug: g.slug };
  });
}

async function adminsOf(groupId: string) {
  const rows = await db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active"), inArray(groupMembers.role, ["owner", "admin", "moderator"])));
  return rows.map((r) => r.id);
}

/** Beitreten: öffentlich sofort, privat per Anfrage, geheim nur mit Einladung. */
export async function joinGroup(groupId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    await writeLimit(user.id, "group-join", 20);
    const g = await groupById(z.uuid().parse(groupId));
    if (!g) throw new ApiError("NOT_FOUND");
    const m = await getMembership(g.id, user.id);
    if (m?.status === "banned") throw new ApiError("FORBIDDEN", "Du wurdest aus dieser Gruppe ausgeschlossen");
    if (m?.status === "active") return { status: "active" as const };
    if (m?.status === "pending") return { status: "pending" as const };
    if (await isBlockedBetween(user.id, g.ownerId)) throw new ApiError("FORBIDDEN", "Beitritt nicht möglich");
    let status: "active" | "pending";
    if (m?.status === "invited" || g.privacy === "public") status = "active";
    else if (g.privacy === "private") status = "pending";
    else throw new ApiError("FORBIDDEN", "Dieser Gruppe kannst du nur per Einladung beitreten");
    await db
      .insert(groupMembers)
      .values({ groupId: g.id, userId: user.id, role: "member", status })
      .onConflictDoUpdate({ target: [groupMembers.groupId, groupMembers.userId], set: { status, createdAt: new Date() } });
    await recountMembers(g.id);
    if (status === "pending") {
      const me = await getSummary(user.id, user);
      await notifyMany(await adminsOf(g.id), { type: "group_request", title: `${me?.name ?? user.username} möchte „${g.name}“ beitreten`, href: `/gruppen/${g.slug}/verwalten`, actorId: user.id });
    }
    revalidatePath(`/gruppen/${g.slug}`, "layout");
    return { status };
  });
}

export async function leaveGroup(groupId: string) {
  return run(async () => {
    const user = await requireUser();
    const g = await groupById(z.uuid().parse(groupId));
    if (!g) throw new ApiError("NOT_FOUND");
    const m = await getMembership(g.id, user.id);
    if (!m) return { left: true };
    if (m.role === "owner") throw new ApiError("INVALID", "Übertrage die Gruppe zuerst an ein anderes Mitglied");
    if (m.status === "banned") return { left: true };
    await db.delete(groupMembers).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, user.id)));
    await recountMembers(g.id);
    revalidatePath(`/gruppen/${g.slug}`, "layout");
    return { left: true };
  });
}

/** Mitglied per Benutzername einladen (Moderatoren und höher). */
export async function inviteToGroup(input: { groupId: string; username: string }) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = z.object({ groupId: z.uuid(), username: z.string().trim().toLowerCase().min(3).max(20) }).parse(input);
    await limitOrThrow(`group-invite:${user.id}`, 50, 3600);
    const { g } = await loadAdmin(user, data.groupId, "moderator");
    const [target] = await db.select({ id: users.id }).from(users).where(and(eq(users.username, data.username.replace(/^@/, "")), eq(users.status, "active")));
    if (!target) throw new ApiError("NOT_FOUND", "Benutzer nicht gefunden");
    if (await isBlockedBetween(user.id, target.id)) throw new ApiError("FORBIDDEN", "Einladung nicht möglich");
    const m = await getMembership(g.id, target.id);
    if (m?.status === "active") throw new ApiError("CONFLICT", "Ist bereits Mitglied");
    if (m?.status === "banned") throw new ApiError("CONFLICT", "Ist aus der Gruppe ausgeschlossen");
    if (m?.status === "pending") {
      await setStatus(g, target.id, "active");
      return { status: "active" };
    }
    await db
      .insert(groupMembers)
      .values({ groupId: g.id, userId: target.id, role: "member", status: "invited" })
      .onConflictDoUpdate({ target: [groupMembers.groupId, groupMembers.userId], set: { status: "invited" } });
    const me = await getSummary(user.id, user);
    await notify(target.id, { type: "group_invite", title: `${me?.name ?? user.username} hat dich in „${g.name}“ eingeladen`, href: `/gruppen/${g.slug}`, actorId: user.id });
    return { status: "invited" };
  });
}

async function setStatus(g: Group, userId: string, status: "active" | "banned") {
  await db.update(groupMembers).set({ status, ...(status === "banned" ? { role: "member" as const } : {}) }).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, userId)));
  await recountMembers(g.id);
}

async function targetMembership(g: Group, userId: string, actor: Membership, actorUser: SessionUser) {
  const t = await getMembership(g.id, userId);
  if (!t) throw new ApiError("NOT_FOUND", "Mitglied nicht gefunden");
  if (t.role === "owner") throw new ApiError("FORBIDDEN", "Der Inhaber kann nicht entfernt werden");
  if (!isStaff(actorUser) && actor && roleRank(t.role) >= roleRank(actor.role)) throw new ApiError("FORBIDDEN", "Keine Berechtigung für dieses Mitglied");
  return t;
}

const MemberAction = z.object({
  groupId: z.uuid(),
  userId: z.uuid(),
  action: z.enum(["approve", "reject", "remove", "ban", "unban", "role"]),
  role: z.enum(["admin", "moderator", "member"]).optional(),
});

/** Anfragen annehmen/ablehnen, entfernen, sperren, entsperren, Rollen vergeben. */
export async function manageMember(input: z.input<typeof MemberAction>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = MemberAction.parse(input);
    await writeLimit(user.id, "group-manage", 120);
    const { g, m } = await loadAdmin(user, data.groupId, data.action === "role" ? "admin" : "moderator");
    const t = await targetMembership(g, data.userId, m, user);
    switch (data.action) {
      case "approve":
        if (t.status !== "pending") throw new ApiError("INVALID", "Keine offene Anfrage");
        await setStatus(g, data.userId, "active");
        await notify(data.userId, { type: "group_joined", title: `Deine Anfrage für „${g.name}“ wurde angenommen`, href: `/gruppen/${g.slug}` });
        break;
      case "reject":
      case "remove":
        await db.delete(groupMembers).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, data.userId)));
        await recountMembers(g.id);
        break;
      case "ban":
        await setStatus(g, data.userId, "banned");
        break;
      case "unban":
        await db.delete(groupMembers).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, data.userId), eq(groupMembers.status, "banned")));
        break;
      case "role": {
        if (!data.role) throw new ApiError("INVALID", "Rolle fehlt");
        if (data.role === "admin" && !isStaff(user) && m?.role !== "owner") throw new ApiError("FORBIDDEN", "Nur der Inhaber kann Admins ernennen");
        if (t.status !== "active") throw new ApiError("INVALID", "Nur aktive Mitglieder");
        await db.update(groupMembers).set({ role: data.role }).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, data.userId)));
        break;
      }
    }
    revalidatePath(`/gruppen/${g.slug}`, "layout");
    return { ok: true };
  });
}

export async function transferOwnership(input: { groupId: string; userId: string }) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = z.object({ groupId: z.uuid(), userId: z.uuid() }).parse(input);
    const { g } = await loadAdmin(user, data.groupId, "owner");
    const t = await getMembership(g.id, data.userId);
    if (t?.status !== "active") throw new ApiError("INVALID", "Nur an aktive Mitglieder übertragbar");
    await db.update(groupMembers).set({ role: "admin" }).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, g.ownerId)));
    await db.update(groupMembers).set({ role: "owner" }).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, data.userId)));
    await db.update(groups).set({ ownerId: data.userId }).where(eq(groups.id, g.id));
    await notify(data.userId, { type: "group_owner", title: `Du bist jetzt Inhaber von „${g.name}“`, href: `/gruppen/${g.slug}/verwalten` });
    revalidatePath(`/gruppen/${g.slug}`, "layout");
    return { ok: true };
  });
}

export async function deleteGroup(groupId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const { g } = await loadAdmin(user, z.uuid().parse(groupId), "owner");
    await db.delete(groups).where(eq(groups.id, g.id));
    revalidatePath("/gruppen");
    return { ok: true };
  });
}

/** Vorab-Moderation: Beitrag freigeben oder ablehnen (ablehnen = löschen). */
export async function reviewPost(input: { postId: string; approve: boolean }) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const data = z.object({ postId: z.uuid(), approve: z.boolean() }).parse(input);
    await writeLimit(user.id, "group-review", 120);
    const [p] = await db.select().from(posts).where(eq(posts.id, data.postId));
    if (!p?.groupId || p.isDraft) throw new ApiError("NOT_FOUND");
    const { g } = await loadAdmin(user, p.groupId, "moderator");
    if (data.approve) {
      await db.update(posts).set({ approved: true, createdAt: new Date() }).where(eq(posts.id, p.id));
      await notify(p.authorId, { type: "group_post", title: `Dein Beitrag in „${g.name}“ wurde freigegeben`, href: `/feed/${p.id}` });
      const [author] = await db.select().from(users).where(eq(users.id, p.authorId));
      if (author) await notifyMentions(author, p.body, `/feed/${p.id}`, []);
    } else {
      await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, p.id));
    }
    revalidatePath(`/gruppen/${g.slug}`, "layout");
    return { ok: true };
  });
}
