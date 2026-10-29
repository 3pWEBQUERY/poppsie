/** Gemeinsame Typen des Content-Moduls (Feed, Forum, Gruppen). Client-sicher. */

export const REACTIONS = [
  { kind: "like", emoji: "👍", label: "Gefällt mir" },
  { kind: "love", emoji: "❤️", label: "Liebe" },
  { kind: "fire", emoji: "🔥", label: "Heiss" },
  { kind: "laugh", emoji: "😂", label: "Lustig" },
  { kind: "wow", emoji: "😮", label: "Wow" },
  { kind: "sad", emoji: "😢", label: "Traurig" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];
export type ReactionTarget = "post" | "comment" | "story";
export type Visibility = "public" | "followers" | "members";
export type ContentContext = "feed" | "group" | "forum";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Öffentlich",
  followers: "Nur Follower",
  members: "Nur Mitglieder",
};

export type Author = {
  id: string;
  username: string;
  name: string;
  accountType: "member" | "escort" | "club";
  avatarUrl: string | null;
  verified: boolean;
  href: string;
  online?: boolean;
};

export type MediaView = {
  id: string;
  kind: "image" | "video";
  thumbUrl: string | null;
  url: string | null;
  width: number | null;
  height: number | null;
  /** Gäste in Bereichen mit Erwachsenen-Medien sehen nur die unkenntliche Variante. */
  locked?: boolean;
};

export type EmbedType = "profile" | "thread" | "post" | "group" | "highlight";
export type EmbedRef = { type: EmbedType; id: string };

export type EmbedPreview = EmbedRef & {
  available: boolean;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  imageUrl?: string | null;
  href: string;
  label: string;
};

export type ReactionSummary = { counts: Partial<Record<ReactionKind, number>>; total: number; mine: ReactionKind | null };

export type QuoteView = { id: string; author: Pick<Author, "name" | "href"> | null; excerpt: string; deleted: boolean };

export type PostView = {
  id: string;
  context: ContentContext;
  groupId: string | null;
  threadId: string | null;
  author: Author;
  body: string;
  visibility: Visibility;
  media: MediaView[];
  embeds: EmbedPreview[];
  quote: QuoteView | null;
  reactions: ReactionSummary;
  commentCount: number;
  approved: boolean;
  editedAt: string | null;
  createdAt: string;
  href: string;
  canEdit: boolean;
  canDelete: boolean;
  /** Forum: Anzahl Beiträge des Autors, Geschlecht für das Symbol. */
  authorPosts?: number;
  authorGender?: string | null;
};

export type CommentView = {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number;
  author: Author;
  body: string;
  media: MediaView | null;
  reactions: ReactionSummary;
  editedAt: string | null;
  createdAt: string;
  deleted: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type Reactor = { user: Author; kind: ReactionKind };

export type MentionHit = { username: string; name: string; avatarUrl: string | null; accountType: string };

export type DraftView = { id: string; body: string; media: { id: string; kind: "image" | "video"; thumbUrl: string; url: string }[]; updatedAt: string };

export const MAX_MEDIA = 10;
export const MAX_BODY = 5000;
export const MAX_COMMENT = 2000;
/** Kommentar-Ebenen, die direkt sichtbar sind; tiefere Antworten hinter "Weitere Antworten anzeigen". */
export const VISIBLE_DEPTH = 3;
export const MAX_DEPTH = 8;
