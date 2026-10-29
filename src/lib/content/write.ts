import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { postMedia, posts, users } from "@/db/schema";
import { extractTags } from "@/components/shared/rich-text";
import { ApiError } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { notifyMany } from "@/lib/notify";
import { getSummary } from "@/lib/users/summary";
import { visibleToSql } from "@/lib/visibility";
import { resolveEmbeds, embedKey } from "./embeds";
import { assertOwnMedia } from "./media";
import { MAX_BODY, MAX_MEDIA, type EmbedRef } from "./types";

export const EmbedInput = z.object({ type: z.enum(["profile", "thread", "post", "group", "highlight"]), id: z.uuid() });

export const BodyInput = z
  .string()
  .max(MAX_BODY, `Maximal ${MAX_BODY} Zeichen`)
  // Steuerzeichen (ausser Zeilenumbruch/Tab) entfernen; Emojis bleiben als Unicode-Text.
  .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n/g, "\n").trim());

export const MediaIdsInput = z.array(z.uuid()).max(MAX_MEDIA, `Maximal ${MAX_MEDIA} Medien`).default([]);

/** Nur Einbettungen behalten, die der Autor selbst sehen darf (max. 5, ohne Duplikate). */
export async function cleanEmbeds(refs: EmbedRef[], user: SessionUser, countries: string[]) {
  const unique = [...new Map(refs.map((r) => [embedKey(r), r])).values()].slice(0, 5);
  if (!unique.length) return [];
  const resolved = await resolveEmbeds(unique, user, countries);
  return unique.filter((r) => resolved.get(embedKey(r))?.available);
}

export async function attachMedia(postId: string, mediaIds: string[]) {
  await db.delete(postMedia).where(eq(postMedia.postId, postId));
  if (mediaIds.length) await db.insert(postMedia).values(mediaIds.map((mediaId, i) => ({ postId, mediaId, sortOrder: i })));
}

type NewPost = Omit<typeof posts.$inferInsert, "authorId" | "hashtags" | "id">;

/** Beitrag anlegen (Feed, Gruppe, Forum): Medien prüfen, Hashtags speichern, Erwähnte benachrichtigen. */
export async function insertPost(user: SessionUser, values: NewPost, mediaIds: string[], opts: { href: (id: string) => string; notifyMentions?: boolean }) {
  const body = values.body ?? "";
  if (!body && !mediaIds.length && !(values.embeds?.length ?? 0)) throw new ApiError("INVALID", "Der Beitrag ist leer");
  await assertOwnMedia(user.id, mediaIds, ["post", "comment", "group"]);
  const { hashtags } = extractTags(body);
  const [row] = await db
    .insert(posts)
    .values({ ...values, body, authorId: user.id, hashtags })
    .returning();
  await attachMedia(row!.id, mediaIds);
  if (opts.notifyMentions !== false && !values.isDraft) await notifyMentions(user, body, opts.href(row!.id), []);
  return row!;
}

/** @Erwähnungen benachrichtigen (keine Blockierten, nicht sich selbst, nur neue Erwähnungen). */
export async function notifyMentions(author: SessionUser, text: string, href: string, already: string[]) {
  const names = extractTags(text).mentions.filter((m) => !already.includes(m) && m !== author.username).slice(0, 20);
  if (!names.length) return;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.username, names), ne(users.id, author.id), eq(users.status, "active"), visibleToSql(users.id, author.id, [], { requireKyc: false })));
  if (!rows.length) return;
  const me = await getSummary(author.id, author);
  await notifyMany(
    rows.map((r) => r.id),
    { type: "mention", title: `${me?.name ?? author.username} hat dich erwähnt`, body: text.slice(0, 140), href, actorId: author.id },
  );
}
