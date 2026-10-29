import { and, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { stories } from "@/db/schema";

/** Welche dieser User haben eine aktive (nicht abgelaufene) Story? Für den Story-Ring auf Profilkarten. */
export async function usersWithActiveStory(userIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const rows = await db
    .selectDistinct({ id: stories.authorId })
    .from(stories)
    .where(and(inArray(stories.authorId, ids), gt(stories.expiresAt, new Date())));
  return new Set(rows.map((r) => r.id));
}
