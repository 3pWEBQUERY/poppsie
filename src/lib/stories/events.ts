import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { track } from "@/lib/analytics";
import type { SessionUser } from "@/lib/auth/session";

/** Statistik bei neuen Story-Likes (Reaktionen mit target_type "story"). */
export async function onStoryReaction(user: SessionUser, storyId: string, added: boolean) {
  if (!added) return;
  const [s] = await db.select({ authorId: stories.authorId }).from(stories).where(eq(stories.id, storyId));
  if (s) await track(s.authorId, "story_like", { viewerId: user.id, source: "story", refId: storyId });
}
