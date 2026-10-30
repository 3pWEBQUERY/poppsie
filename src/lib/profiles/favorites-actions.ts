"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { favoriteFolders, favorites } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { writeLimit } from "@/lib/rate-limit";

const name = z.string().trim().min(1, "Bitte gib einen Namen ein").max(40, "Höchstens 40 Zeichen");
const ids = z.array(z.uuid()).min(1).max(500);

async function gate(action: string) {
  const user = await requireUser({ complete: true });
  await writeLimit(user.id, `fav-${action}`, 120);
  return user;
}

async function ownFolder(userId: string, folderId: string) {
  const [f] = await db
    .select()
    .from(favoriteFolders)
    .where(and(eq(favoriteFolders.id, folderId), eq(favoriteFolders.userId, userId)));
  if (!f) throw new ApiError("NOT_FOUND", "Ordner nicht gefunden");
  return f;
}

export async function createFavoriteFolder(input: string) {
  return run(async () => {
    const user = await gate("folder");
    const n = name.parse(input);
    const [{ c }] = await db.select({ c: count() }).from(favoriteFolders).where(eq(favoriteFolders.userId, user.id));
    if (c >= 30) throw new ApiError("INVALID", "Höchstens 30 Ordner");
    const [f] = await db.insert(favoriteFolders).values({ userId: user.id, name: n }).returning();
    revalidatePath("/dashboard/favoriten");
    return { id: f!.id, name: f!.name };
  });
}

export async function renameFavoriteFolder(folderId: string, input: string) {
  return run(async () => {
    const user = await gate("folder");
    z.uuid().parse(folderId);
    await ownFolder(user.id, folderId);
    const n = name.parse(input);
    await db.update(favoriteFolders).set({ name: n }).where(eq(favoriteFolders.id, folderId));
    revalidatePath("/dashboard/favoriten");
    return { id: folderId, name: n };
  });
}

/** Ordner löschen; die Favorite bleiben erhalten (ohne Ordner). */
export async function deleteFavoriteFolder(folderId: string) {
  return run(async () => {
    const user = await gate("folder");
    z.uuid().parse(folderId);
    await ownFolder(user.id, folderId);
    await db.delete(favoriteFolders).where(eq(favoriteFolders.id, folderId));
    revalidatePath("/dashboard/favoriten");
    return { id: folderId };
  });
}

export async function moveFavorites(targetIds: string[], folderId: string | null) {
  return run(async () => {
    const user = await gate("move");
    const list = ids.parse(targetIds);
    if (folderId) await ownFolder(user.id, z.uuid().parse(folderId));
    await db
      .update(favorites)
      .set({ folderId })
      .where(and(eq(favorites.userId, user.id), inArray(favorites.targetId, list)));
    return { folderId };
  });
}

const Patch = z.object({ note: z.string().trim().max(1000, "Höchstens 1000 Zeichen").nullable().optional(), notify: z.boolean().optional() });

/** Private Notiz und "benachrichtigen" pro Favorit. */
export async function updateFavorite(targetId: string, input: z.input<typeof Patch>) {
  return run(async () => {
    const user = await gate("update");
    z.uuid().parse(targetId);
    const p = Patch.parse(input);
    const set: Partial<typeof favorites.$inferInsert> = {};
    if (p.note !== undefined) set.note = p.note || null;
    if (p.notify !== undefined) set.notify = p.notify;
    if (!Object.keys(set).length) return { ok: true };
    const res = await db
      .update(favorites)
      .set(set)
      .where(and(eq(favorites.userId, user.id), eq(favorites.targetId, targetId)))
      .returning({ id: favorites.targetId });
    if (!res.length) throw new ApiError("NOT_FOUND");
    return { ok: true };
  });
}

export async function removeFavorites(targetIds: string[]) {
  return run(async () => {
    const user = await gate("remove");
    const list = ids.parse(targetIds);
    await db.delete(favorites).where(and(eq(favorites.userId, user.id), inArray(favorites.targetId, list)));
    revalidatePath("/dashboard/favoriten");
    return { removed: list.length };
  });
}
