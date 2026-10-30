import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comments } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { getPost, postAccess, type PostAccess } from "./access";

/** Kommentare erben die Rechte ihres Beitrags. */
export async function commentAccess(viewer: SessionUser | null, commentId: string, countries: string[]): Promise<PostAccess & { comment: typeof comments.$inferSelect | null }> {
  const [c] = await db.select().from(comments).where(eq(comments.id, commentId));
  const none = { canView: false, canInteract: false, moderator: false, adultOnly: false, locked: false, comment: null };
  if (!c || c.deletedAt) return none;
  const p = await getPost(c.postId);
  if (!p) return none;
  return { ...(await postAccess(viewer, p, countries)), comment: c };
}
