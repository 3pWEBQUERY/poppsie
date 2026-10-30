"use server";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, media, messageAttachments, messages, reactions, users } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { checkSend, isBlockedEither } from "@/lib/messaging/connect";
import { findConversation, getOrCreateConversation, insertMessage } from "@/lib/messaging/core";
import { getMessagesPage, getMessageViews, getTargetUser, getThreadMeta, listConversations, partnerOf, previewText } from "@/lib/messaging/queries";
import { EDIT_WINDOW_MS, MAX_ATTACHMENTS, MAX_BODY, type ThreadData } from "@/lib/messaging/types";
import { publish } from "@/lib/realtime/publish";
import { limitOrThrow, writeLimit } from "@/lib/rate-limit";
import { canViewProfile } from "@/lib/visibility";

const uuid = z.uuid();

async function member(conversationId: string) {
  const user = await requireUser({ complete: true });
  uuid.parse(conversationId);
  const partnerId = await partnerOf(conversationId, user.id);
  if (!partnerId) throw new ApiError("NOT_FOUND", "Chat nicht gefunden");
  return { user, partnerId };
}

/* ---------------- Laden ---------------- */

export async function loadConversations(search?: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const q = z.string().max(80).optional().parse(search);
    return listConversations(user, { search: q });
  });
}

export async function loadConversationItem(conversationId: string) {
  return run(async () => {
    const { user } = await member(conversationId);
    const [item] = await listConversations(user, { ids: [conversationId] });
    return item ?? null;
  });
}

export async function loadThread(conversationId: string) {
  return run(async (): Promise<ThreadData> => {
    const { user, partnerId } = await member(conversationId);
    const meta = await getThreadMeta(user, partnerId, conversationId);
    if (!meta) throw new ApiError("NOT_FOUND", "Chat nicht gefunden");
    return { meta, page: await getMessagesPage(conversationId, user.id) };
  });
}

export async function loadOlder(conversationId: string, cursor: string) {
  return run(async () => {
    const { user } = await member(conversationId);
    return getMessagesPage(conversationId, user.id, z.string().max(80).parse(cursor));
  });
}

export async function loadMessages(conversationId: string, ids: string[]) {
  return run(async () => {
    const { user } = await member(conversationId);
    return getMessageViews(conversationId, z.array(uuid).max(100).parse(ids), user.id);
  });
}

/** Messages mit einer bestimmten Buchung (Buchungskarte nach booking.updated neu laden). */
export async function loadBookingMessages(conversationId: string, bookingId: string) {
  return run(async () => {
    const { user } = await member(conversationId);
    const rows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.bookingId, uuid.parse(bookingId))));
    return getMessageViews(
      conversationId,
      rows.map((r) => r.id),
      user.id,
    );
  });
}

export async function loadMeta(conversationId: string) {
  return run(async () => {
    const { user, partnerId } = await member(conversationId);
    return getThreadMeta(user, partnerId, conversationId);
  });
}

/* ---------------- Senden ---------------- */

const SendInput = z
  .object({
    conversationId: uuid.optional(),
    toUserId: uuid.optional(),
    body: z.string().max(MAX_BODY).optional(),
    replyToId: uuid.optional(),
    attachments: z
      .array(z.object({ mediaId: uuid, viewOnce: z.boolean().optional() }))
      .max(MAX_ATTACHMENTS)
      .optional(),
  })
  .refine((v) => v.conversationId || v.toUserId, "Empfänger fehlt");

export async function sendMessage(input: z.input<typeof SendInput>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const v = SendInput.parse(input);
    const body = v.body?.trim() || null;
    const attachments = v.attachments ?? [];
    if (!body && attachments.length === 0) throw new ApiError("INVALID", "Nachricht ist leer");
    await writeLimit(user.id, "message", 30, 60);
    await limitOrThrow(`w:message-h:${user.id}`, 600, 3600, "Du hast sehr viele Nachrichten gesendet. Bitte warte etwas.");

    let conversationId = v.conversationId ?? null;
    let partnerId: string | null;
    if (conversationId) {
      partnerId = await partnerOf(conversationId, user.id);
      if (!partnerId) throw new ApiError("NOT_FOUND", "Chat nicht gefunden");
    } else {
      partnerId = v.toUserId!;
      conversationId = await findConversation(user.id, partnerId);
    }

    const target = await getTargetUser(partnerId);
    if (!target) throw new ApiError("NOT_FOUND", "Profil nicht gefunden");
    const existingMessages = conversationId
      ? await db.select({ id: messages.id }).from(messages).where(eq(messages.conversationId, conversationId)).limit(1)
      : [];
    const isNewChat = existingMessages.length === 0;
    if (isNewChat) {
      // Neue Chats nur mit Profilen, die man sehen darf (Länder-Sperre, ausgeblendet, KYC).
      const [full] = await db.select().from(users).where(eq(users.id, partnerId));
      if (!full || !(await canViewProfile(user, full))) throw new ApiError("NOT_FOUND", "Profil nicht gefunden");
    }
    const permission = await checkSend(user, target, { isNewChat });
    if (!permission.ok) throw new ApiError(permission.code === "REQUEST_LIMIT" ? "RATE_LIMITED" : "FORBIDDEN", permission.message);

    if (!conversationId) {
      const created = await getOrCreateConversation(user.id, partnerId, {
        isRequest: permission.isNewRequest,
        requestedBy: permission.isNewRequest ? user.id : undefined,
      });
      conversationId = created.id;
    } else if (isNewChat && permission.isNewRequest) {
      await db.update(conversations).set({ isRequest: true, requestedBy: user.id }).where(eq(conversations.id, conversationId));
    }

    let replyToId: string | null = null;
    if (v.replyToId) {
      const [r] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, v.replyToId), eq(messages.conversationId, conversationId)));
      replyToId = r?.id ?? null;
    }

    if (attachments.length) {
      const ids = [...new Set(attachments.map((a) => a.mediaId))];
      const owned = await db
        .select({ id: media.id, kind: media.kind })
        .from(media)
        .where(and(inArray(media.id, ids), eq(media.ownerId, user.id), eq(media.purpose, "message"), ne(media.status, "rejected")));
      if (owned.length !== ids.length) throw new ApiError("INVALID", "Anhang nicht gefunden");
      const kinds = new Map(owned.map((m) => [m.id, m.kind]));
      // "Einmal ansehen" nur für Bilder und Videos
      for (const a of attachments) if (a.viewOnce && !["image", "video"].includes(kinds.get(a.mediaId) ?? "")) a.viewOnce = false;
    }

    const firstKind = attachments.length ? (await db.select({ kind: media.kind }).from(media).where(eq(media.id, attachments[0]!.mediaId)))[0]?.kind : null;
    const row = await insertMessage({
      conversationId,
      senderId: user.id,
      type: attachments.length ? "media" : "text",
      body,
      replyToId,
      attachments: [...new Map(attachments.map((a) => [a.mediaId, a])).values()],
      preview: previewText({ type: "text", body, deletedAt: null, kind: firstKind ?? null }),
    });
    const [view] = await getMessageViews(conversationId, [row.id], user.id);
    return { conversationId, message: view! };
  });
}

/* ---------------- Bearbeiten, Löschen, Reaktionen ---------------- */

export async function editMessage(messageId: string, body: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    uuid.parse(messageId);
    const text = z.string().trim().min(1, "Nachricht ist leer").max(MAX_BODY).parse(body);
    await writeLimit(user.id, "message-edit");
    const [m] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!m || m.senderId !== user.id) throw new ApiError("NOT_FOUND", "Nachricht nicht gefunden");
    if (m.deletedAt || (m.type !== "text" && m.type !== "media")) throw new ApiError("INVALID", "Diese Nachricht kann nicht bearbeitet werden");
    if (Date.now() - m.createdAt.getTime() > EDIT_WINDOW_MS) throw new ApiError("INVALID", "Nachrichten können nur 15 Minuten lang bearbeitet werden");
    await db.update(messages).set({ body: text, editedAt: new Date() }).where(eq(messages.id, messageId));
    await notifyUpdated(m.conversationId, messageId);
    const [view] = await getMessageViews(m.conversationId, [messageId], user.id);
    return view!;
  });
}

/** Löschen für beide: Inhalt bleibt in der DB (Moderation), angezeigt wird "Nachricht gelöscht". */
export async function deleteMessage(messageId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    uuid.parse(messageId);
    await writeLimit(user.id, "message-delete");
    const [m] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!m || m.senderId !== user.id) throw new ApiError("NOT_FOUND", "Nachricht nicht gefunden");
    if (m.type === "booking_card" || m.type === "system") throw new ApiError("INVALID", "Diese Nachricht kann nicht gelöscht werden");
    if (!m.deletedAt) await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
    await notifyUpdated(m.conversationId, messageId);
    const [view] = await getMessageViews(m.conversationId, [messageId], user.id);
    return view!;
  });
}

/** Reaktion setzen; gleiches Emoji erneut entfernt sie, anderes Emoji ersetzt sie. */
export async function reactToMessage(messageId: string, emoji: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    uuid.parse(messageId);
    const e = z
      .string()
      .min(1)
      .max(32)
      .refine((s) => /^[\p{Extended_Pictographic}\p{Emoji_Component}]+$/u.test(s) && !/^[0-9#*]+$/.test(s), "Ungültiges Emoji")
      .parse(emoji);
    await writeLimit(user.id, "message-react");
    const [m] = await db.select({ conversationId: messages.conversationId, deletedAt: messages.deletedAt }).from(messages).where(eq(messages.id, messageId));
    if (!m || m.deletedAt) throw new ApiError("NOT_FOUND", "Nachricht nicht gefunden");
    const partnerId = await partnerOf(m.conversationId, user.id);
    if (!partnerId) throw new ApiError("NOT_FOUND", "Nachricht nicht gefunden");
    if (await isBlockedEither(user.id, partnerId)) throw new ApiError("FORBIDDEN", "Ihr könnt euch keine Nachrichten schreiben.");
    const where = and(eq(reactions.targetType, "message"), eq(reactions.targetId, messageId), eq(reactions.userId, user.id));
    const [existing] = await db.select({ emoji: reactions.emoji }).from(reactions).where(where);
    if (existing?.emoji === e) await db.delete(reactions).where(where);
    else if (existing) await db.update(reactions).set({ emoji: e, createdAt: new Date() }).where(where);
    else await db.insert(reactions).values({ targetType: "message", targetId: messageId, userId: user.id, emoji: e });
    await notifyUpdated(m.conversationId, messageId);
    const [view] = await getMessageViews(m.conversationId, [messageId], user.id);
    return view!;
  });
}

async function notifyUpdated(conversationId: string, messageId: string) {
  const ids = await db.execute<{ user_id: string }>(sql`SELECT user_id FROM conversation_members WHERE conversation_id = ${conversationId}`);
  await publish(
    ids.rows.map((r) => r.user_id),
    { type: "message.updated", conversationId, messageId },
  );
}

/* ---------------- Gelesen ---------------- */

export async function markRead(conversationId: string) {
  return run(async () => {
    const { user, partnerId } = await member(conversationId);
    await limitOrThrow(`w:read:${user.id}`, 240, 60);
    const res = await db.execute<{ last_read_at: Date }>(sql`
      UPDATE conversation_members SET last_read_at = GREATEST(COALESCE(last_read_at, 'epoch'::timestamptz), now())
      WHERE conversation_id = ${conversationId} AND user_id = ${user.id}
      RETURNING last_read_at`);
    const at = new Date(res.rows[0]!.last_read_at).toISOString();
    // Nicht zugestellte Nachrichten gelten spätestens jetzt als zugestellt.
    await db
      .update(messages)
      .set({ deliveredAt: new Date() })
      .where(and(eq(messages.conversationId, conversationId), ne(messages.senderId, user.id), isNull(messages.deliveredAt)));
    const partner = await getTargetUser(partnerId);
    const [conv] = await db.select({ isRequest: conversations.isRequest, requestedBy: conversations.requestedBy }).from(conversations).where(eq(conversations.id, conversationId));
    const openRequest = Boolean(conv?.isRequest && conv.requestedBy !== user.id);
    const receipts = user.readReceipts && Boolean(partner?.readReceipts) && !openRequest;
    await publish(receipts ? [user.id, partnerId] : [user.id], { type: "message.read", conversationId, userId: user.id, at });
    return { at };
  });
}

/* ---------------- Einmal ansehen ---------------- */

/** Status eines Einmal-Mediums nach dem Öffnen an beide melden (Absender sieht "geöffnet"). */
export async function viewOnceOpened(messageId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    uuid.parse(messageId);
    const [m] = await db.select({ conversationId: messages.conversationId }).from(messages).where(eq(messages.id, messageId));
    if (!m || !(await partnerOf(m.conversationId, user.id))) throw new ApiError("NOT_FOUND");
    const [att] = await db.select({ v: messageAttachments.viewedAt }).from(messageAttachments).where(eq(messageAttachments.messageId, messageId)).limit(1);
    if (att?.v) await notifyUpdated(m.conversationId, messageId);
    return null;
  });
}
