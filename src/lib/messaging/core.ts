import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversationMembers, conversations, messages } from "@/db/schema";
import { publish } from "@/lib/realtime/publish";

/**
 * Gemeinsamer Messaging-Kern (ohne next/headers, auch im Worker nutzbar).
 * Wird vom Messenger, von Buchungen (Buchungskarten) und vom Planer (Broadcasts) verwendet.
 */
export async function findConversation(a: string, b: string) {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT cm1.conversation_id AS id FROM conversation_members cm1
    JOIN conversation_members cm2 ON cm2.conversation_id = cm1.conversation_id AND cm2.user_id = ${b}
    WHERE cm1.user_id = ${a}
      AND (SELECT count(*) FROM conversation_members x WHERE x.conversation_id = cm1.conversation_id) = 2
    LIMIT 1`);
  return rows.rows[0]?.id ?? null;
}

export async function getOrCreateConversation(a: string, b: string, opts: { isRequest?: boolean; requestedBy?: string } = {}) {
  const existing = await findConversation(a, b);
  if (existing) return { id: existing, created: false };
  const [c] = await db
    .insert(conversations)
    .values({ isRequest: opts.isRequest ?? false, requestedBy: opts.requestedBy ?? null })
    .returning({ id: conversations.id });
  await db.insert(conversationMembers).values([
    { conversationId: c!.id, userId: a },
    { conversationId: c!.id, userId: b },
  ]);
  return { id: c!.id, created: true };
}

export async function conversationMemberIds(conversationId: string) {
  const rows = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(eq(conversationMembers.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

export async function isMember(conversationId: string, userId: string) {
  const rows = await db
    .select({ u: conversationMembers.userId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  return rows.length > 0;
}

type InsertMessage = {
  conversationId: string;
  senderId: string;
  type?: "text" | "media" | "booking_card" | "system";
  body?: string | null;
  replyToId?: string | null;
  bookingId?: string | null;
};

/** Nachricht speichern, Konversation aktualisieren und Echtzeit-Event an alle Teilnehmer senden. */
export async function insertMessage(m: InsertMessage) {
  const [row] = await db
    .insert(messages)
    .values({ conversationId: m.conversationId, senderId: m.senderId, type: m.type ?? "text", body: m.body ?? null, replyToId: m.replyToId ?? null, bookingId: m.bookingId ?? null })
    .returning();
  await db.update(conversations).set({ lastMessageAt: row!.createdAt }).where(eq(conversations.id, m.conversationId));
  // Archivierte Chats tauchen bei neuer Nachricht wieder auf
  await db
    .update(conversationMembers)
    .set({ archived: false })
    .where(eq(conversationMembers.conversationId, m.conversationId));
  const members = await conversationMemberIds(m.conversationId);
  await publish(members, {
    type: "message.new",
    conversationId: m.conversationId,
    messageId: row!.id,
    senderId: m.senderId,
    preview: m.type === "booking_card" ? "Buchung" : (m.body ?? "").slice(0, 80),
  });
  return row!;
}
