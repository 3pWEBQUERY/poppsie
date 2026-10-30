import type { BookingView } from "@/lib/bookings/types";

/** Gemeinsame Typen für Messenger (Server und Client). */

export type AttachmentKind = "image" | "video" | "audio" | "file";

export type AttachmentView = {
  mediaId: string;
  kind: AttachmentKind;
  mime: string;
  fileName: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  viewOnce: boolean;
  /** Einmal-Medium wurde von der Empfängerin bereits geöffnet. */
  viewed: boolean;
  /** Bei Einmal-Medien für Empfänger null (sonst würde die Vorschau das Medium "verbrauchen"). */
  thumbUrl: string | null;
  url: string | null;
};

export type ReactionView = { emoji: string; count: number; mine: boolean; userIds: string[] };

export type ReplyView = { id: string; senderId: string; preview: string; deleted: boolean };

export type MessageView = {
  id: string;
  conversationId: string;
  senderId: string;
  type: "text" | "media" | "booking_card" | "system";
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deliveredAt: string | null;
  replyTo: ReplyView | null;
  attachments: AttachmentView[];
  reactions: ReactionView[];
  bookingId: string | null;
  booking: BookingView | null;
};

export type PartnerView = {
  id: string;
  username: string;
  name: string;
  accountType: "member" | "escort" | "club";
  avatarUrl: string | null;
  href: string;
  verified: boolean;
  /** Nur gesetzt, wenn die Person ihren Online-Status zeigt. */
  online: boolean;
  lastSeenAt: string | null;
};

export type ConversationItem = {
  id: string;
  partner: PartnerView;
  preview: string;
  lastSenderId: string | null;
  lastMessageAt: string;
  unread: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  /** Eingehende Nachrichtenanfrage (ich wurde angeschrieben und habe noch nicht geantwortet). */
  incomingRequest: boolean;
  /** Von mir gesendete Anfrage, noch unbeantwortet. */
  outgoingRequest: boolean;
  blocked: boolean;
};

export type SendBlockCode = "SELF" | "BLOCKED" | "UNAVAILABLE" | "CONNECT_OFF" | "CONNECT_RULE" | "REQUEST_LIMIT";

export type SendPermission = { ok: true; isNewRequest: boolean } | { ok: false; code: SendBlockCode; message: string; bookingHref?: string };

export type ThreadMeta = {
  conversationId: string | null;
  partner: PartnerView;
  /** Zeitpunkt, bis zu dem die Gegenseite gelesen hat – null, wenn Lesebestätigungen aus sind. */
  partnerLastReadAt: string | null;
  receipts: boolean;
  canSend: SendPermission;
  incomingRequest: boolean;
  outgoingRequest: boolean;
  blockedByMe: boolean;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
};

export type ThreadPage = { messages: MessageView[]; nextCursor: string | null };

export type ThreadData = { meta: ThreadMeta; page: ThreadPage };

/** Bearbeiten ist 15 Minuten nach dem Senden möglich. */
export const EDIT_WINDOW_MS = 15 * 60_000;
export const MAX_ATTACHMENTS = 10;
export const MAX_BODY = 4000;
/** Online gilt, wenn der WebSocket-Heartbeat (alle 30 s) kürzlich last_seen_at aktualisiert hat. */
export const ONLINE_WINDOW_MS = 75_000;
