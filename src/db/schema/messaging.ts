import { boolean, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { messageType } from "./enums";
import { media } from "./profiles";
import { users } from "./users";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Erste Nachricht eines Mitglieds an eine Escort ist eine Anfrage, bis sie antwortet. */
  isRequest: boolean("is_request").notNull().default(false),
  requestedBy: uuid("requested_by"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    muted: boolean("muted").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conv_members_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: messageType("type").notNull().default("text"),
    body: text("body"),
    replyToId: uuid("reply_to_id"),
    bookingId: uuid("booking_id"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt)],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    /** "Einmal ansehen": nach dem ersten Öffnen durch die Empfängerin gesperrt. */
    viewOnce: boolean("view_once").notNull().default(false),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.mediaId] })],
);
