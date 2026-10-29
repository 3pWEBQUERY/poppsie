import type { Author, ReactionSummary } from "@/lib/content/types";

export type StickerType = "city" | "available_today" | "book_link";
export type Sticker = { type: StickerType; value?: string; x: number; y: number };

export const STICKER_LABELS: Record<StickerType, string> = {
  city: "Stadt",
  available_today: "Heute verfügbar",
  book_link: "Jetzt buchen",
};

export type StoryView = {
  id: string;
  authorId: string;
  kind: "image" | "video";
  url: string;
  thumbUrl: string | null;
  durationSec: number | null;
  overlayText: string | null;
  stickers: Sticker[];
  createdAt: string;
  expiresAt: string;
  highlight: boolean;
  highlightTitle: string | null;
  reactions: ReactionSummary;
  commentCount: number;
  bookHref: string | null;
  seen: boolean;
};

export type StoryAuthorEntry = { author: Author; count: number; latestAt: string; seen: boolean; own?: boolean };

export type HighlightGroup = { key: string; title: string; coverUrl: string | null; storyIds: string[] };

export type StoryCommentView = { id: string; author: Author; body: string; createdAt: string; canDelete: boolean };

export type StoryViewer = {
  key: string;
  user: Author | { anonymous: true; name: string; avatarUrl: string | null };
  viewedAt: string;
  reaction: string | null;
};

export type ManagedStory = {
  id: string;
  kind: "image" | "video";
  thumbUrl: string | null;
  url: string;
  overlayText: string | null;
  createdAt: string;
  expiresAt: string;
  active: boolean;
  highlight: boolean;
  highlightTitle: string | null;
  views: number;
  likes: number;
  comments: number;
};
