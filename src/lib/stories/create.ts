import { db } from "@/db";
import { stories } from "@/db/schema";

export type StorySticker = { type: "city" | "available_today" | "book_link"; value?: string; x: number; y: number };

/** Story veröffentlichen (24 h sichtbar). Genutzt vom Story-Editor und vom Planer. */
export async function createStory(input: { authorId: string; mediaId: string; overlayText?: string | null; stickers?: StorySticker[] }) {
  const [row] = await db
    .insert(stories)
    .values({
      authorId: input.authorId,
      mediaId: input.mediaId,
      overlayText: input.overlayText ?? null,
      stickers: input.stickers ?? [],
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    })
    .returning();
  return row!;
}
