import "server-only";
import { and, eq, gt, or } from "drizzle-orm";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { isStaff } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { visibleToSql } from "@/lib/visibility";

/** Story für eingeloggte Betrachter: aktiv oder Highlight, Autor sichtbar (Länder-Sperre, Blockierung). */
export async function storyAccess(viewer: SessionUser | null, storyId: string, countries: string[]) {
  if (!viewer || !/^[0-9a-f-]{36}$/i.test(storyId)) return null;
  const [s] = await db
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        or(gt(stories.expiresAt, new Date()), eq(stories.highlight, true)),
        isStaff(viewer) ? undefined : or(eq(stories.authorId, viewer.id), visibleToSql(stories.authorId, viewer.id, countries)),
      ),
    );
  return s ?? null;
}

export function isActiveStory(s: { expiresAt: Date }) {
  return s.expiresAt.getTime() > Date.now();
}
