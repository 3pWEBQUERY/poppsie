"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { favorites, users } from "@/db/schema";
import { track } from "@/lib/analytics";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { writeLimit } from "@/lib/rate-limit";

/** Herz-Button: Favorit setzen/entfernen. Gibt den neuen Zustand zurück. */
export async function toggleFavorite(targetId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    z.uuid().parse(targetId);
    if (targetId === user.id) throw new ApiError("INVALID", "Du kannst dich nicht selbst favorisieren");
    await writeLimit(user.id, "favorite");
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId));
    if (!target) throw new ApiError("NOT_FOUND");
    const existing = await db.select().from(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.targetId, targetId)));
    if (existing.length) {
      await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.targetId, targetId)));
      revalidatePath("/dashboard/favoriten");
      return { favorite: false };
    }
    await db.insert(favorites).values({ userId: user.id, targetId });
    await track(targetId, "favorite_add", { viewerId: user.id, source: "profile" });
    revalidatePath("/dashboard/favoriten");
    return { favorite: true };
  });
}
