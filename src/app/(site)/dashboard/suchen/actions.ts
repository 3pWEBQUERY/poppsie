"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { savedSearches } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { writeLimit } from "@/lib/rate-limit";

const Id = z.uuid();

async function own(id: string) {
  const user = await requireUser({ complete: true });
  if (!Id.safeParse(id).success) throw new ApiError("INVALID", "Ungültige Suche");
  await writeLimit(user.id, "saved-search-edit");
  return and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id))!;
}

async function updateOwn(id: string, set: Partial<typeof savedSearches.$inferInsert>) {
  const where = await own(id);
  const rows = await db.update(savedSearches).set(set).where(where).returning({ id: savedSearches.id });
  if (!rows.length) throw new ApiError("NOT_FOUND", "Suche nicht gefunden");
  revalidatePath("/dashboard/suchen");
}

export async function renameSavedSearch(id: string, name: string) {
  return run(async () => {
    const parsed = z.string().trim().min(1).max(80).safeParse(name);
    if (!parsed.success) throw new ApiError("INVALID", "Bitte gib einen Namen (max. 80 Zeichen) ein");
    await updateOwn(id, { name: parsed.data });
  });
}

export async function setSavedSearchNotify(id: string, notify: boolean) {
  return run(async () => {
    // Beim Einschalten ab jetzt zählen, damit keine alten Treffer gemeldet werden.
    await updateOwn(id, notify ? { notify: true, lastCheckedAt: new Date() } : { notify: false });
  });
}

export async function deleteSavedSearch(id: string) {
  return run(async () => {
    const where = await own(id);
    await db.delete(savedSearches).where(where);
    revalidatePath("/dashboard/suchen");
  });
}
