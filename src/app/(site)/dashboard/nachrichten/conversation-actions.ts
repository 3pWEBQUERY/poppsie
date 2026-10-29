"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blocks, conversationMembers, conversations, follows } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { findConversation } from "@/lib/messaging/core";
import { partnerOf } from "@/lib/messaging/queries";
import { publish } from "@/lib/realtime/publish";
import { writeLimit } from "@/lib/rate-limit";

const uuid = z.uuid();
const Flag = z.enum(["pinned", "archived", "muted"]);

async function member(conversationId: string) {
  const user = await requireUser({ complete: true });
  uuid.parse(conversationId);
  const partnerId = await partnerOf(conversationId, user.id);
  if (!partnerId) throw new ApiError("NOT_FOUND", "Chat nicht gefunden");
  return { user, partnerId };
}

/** Anpinnen, Archivieren, Stummschalten (nur für mich). */
export async function setConversationFlag(conversationId: string, flag: "pinned" | "archived" | "muted", value: boolean) {
  return run(async () => {
    const { user } = await member(conversationId);
    const f = Flag.parse(flag);
    await writeLimit(user.id, "conversation-flag");
    await db
      .update(conversationMembers)
      .set({ [f]: z.boolean().parse(value) })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)));
    await publish([user.id], { type: "conversation.updated", conversationId });
    return { [f]: value };
  });
}

/** Nachrichtenanfrage annehmen (ohne zu antworten). */
export async function acceptRequest(conversationId: string) {
  return run(async () => {
    const { user, partnerId } = await member(conversationId);
    await writeLimit(user.id, "conversation-flag");
    const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!c?.isRequest || c.requestedBy === user.id) throw new ApiError("INVALID", "Keine offene Anfrage");
    await db.update(conversations).set({ isRequest: false }).where(eq(conversations.id, conversationId));
    await publish([user.id, partnerId], { type: "conversation.updated", conversationId });
    return null;
  });
}

/** Anfrage ablehnen: Chat wird archiviert, die Gegenseite erfährt nichts. */
export async function declineRequest(conversationId: string) {
  return run(async () => {
    const { user } = await member(conversationId);
    await writeLimit(user.id, "conversation-flag");
    await db
      .update(conversationMembers)
      .set({ archived: true })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)));
    await publish([user.id], { type: "conversation.updated", conversationId });
    return null;
  });
}

/** Blockieren direkt aus dem Chat. Folgen wird in beide Richtungen entfernt. */
export async function blockUser(userId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    uuid.parse(userId);
    if (userId === user.id) throw new ApiError("INVALID", "Du kannst dich nicht selbst blockieren");
    await writeLimit(user.id, "block", 20, 60);
    await db.insert(blocks).values({ blockerId: user.id, blockedId: userId }).onConflictDoNothing();
    await db.delete(follows).where(and(eq(follows.followerId, user.id), eq(follows.followeeId, userId)));
    await db.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followeeId, user.id)));
    await syncConversation(user.id, userId);
    return { blocked: true };
  });
}

export async function unblockUser(userId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    uuid.parse(userId);
    await writeLimit(user.id, "block", 20, 60);
    await db.delete(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, userId)));
    await syncConversation(user.id, userId);
    return { blocked: false };
  });
}

async function syncConversation(a: string, b: string) {
  const id = await findConversation(a, b);
  if (id) await publish([a, b], { type: "conversation.updated", conversationId: id });
}
