import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clubProfiles,
  comments,
  escortProfiles,
  forumCategories,
  forumThreads,
  groups,
  media,
  messageAttachments,
  messages,
  postMedia,
  posts,
  reviews,
  stories,
  users,
} from "@/db/schema";
import { mediaUrl } from "@/lib/media/urls";
import { profileHref } from "@/lib/users/summary";
import type { FlagTarget } from "./labels";

export type PreviewMedia = { id: string; kind: string; purpose: string; status: string; thumb: string; original: string };

export type TargetPreview = {
  type: FlagTarget;
  id: string;
  exists: boolean;
  /** Urheber bzw. betroffene Person (serverseitig ermittelt, nie vom Client übernommen). */
  ownerId: string | null;
  heading: string;
  title?: string | null;
  body?: string | null;
  media: PreviewMedia[];
  href?: string | null;
  meta: { label: string; value: string }[];
  /** Bereits entfernt / ausgeblendet / gesperrt. */
  removed: boolean;
  state: string[];
};

type MediaRow = typeof media.$inferSelect;

function toPreviewMedia(m: Pick<MediaRow, "id" | "kind" | "purpose" | "status">): PreviewMedia {
  return { id: m.id, kind: m.kind, purpose: m.purpose, status: m.status, thumb: mediaUrl(m.id, m.kind === "image" ? "t" : "o", 1800), original: mediaUrl(m.id, "o", 1800) };
}

async function mediaByIds(ids: (string | null | undefined)[]) {
  const list = ids.filter((x): x is string => Boolean(x));
  if (!list.length) return [];
  const rows = await db.select().from(media).where(inArray(media.id, list));
  return rows.map(toPreviewMedia);
}

const empty = (type: FlagTarget, id: string): TargetPreview => ({
  type,
  id,
  exists: false,
  ownerId: null,
  heading: "Inhalt nicht mehr vorhanden",
  media: [],
  meta: [],
  removed: true,
  state: ["gelöscht"],
});

const excerpt = (s: string | null | undefined, n = 1200) => (s && s.length > n ? `${s.slice(0, n)} …` : (s ?? null));

/** Vorschau eines gemeldeten Ziels für jeden flag_target-Typ. */
export async function loadTargetPreview(type: FlagTarget, id: string): Promise<TargetPreview> {
  switch (type) {
    case "profile":
      return profilePreview(id);
    case "post": {
      const [p] = await db.select().from(posts).where(eq(posts.id, id));
      if (!p) return empty(type, id);
      const pm = await db.select({ mediaId: postMedia.mediaId }).from(postMedia).where(eq(postMedia.postId, id)).orderBy(asc(postMedia.sortOrder));
      return {
        type,
        id,
        exists: true,
        ownerId: p.authorId,
        heading: p.context === "forum" ? "Forum-Beitrag" : p.context === "group" ? "Gruppen-Beitrag" : "Feed-Beitrag",
        body: excerpt(p.body),
        media: await mediaByIds(pm.map((x) => x.mediaId)),
        meta: [
          { label: "Sichtbarkeit", value: p.visibility },
          { label: "Kommentare", value: String(p.commentCount) },
        ],
        removed: Boolean(p.deletedAt),
        state: [p.deletedAt ? "entfernt" : null, p.isDraft ? "Entwurf" : null, !p.approved ? "nicht freigegeben" : null].filter(Boolean) as string[],
      };
    }
    case "comment": {
      const [c] = await db.select().from(comments).where(eq(comments.id, id));
      if (!c) return empty(type, id);
      const [parent] = await db.select({ body: posts.body }).from(posts).where(eq(posts.id, c.postId));
      return {
        type,
        id,
        exists: true,
        ownerId: c.authorId,
        heading: "Kommentar",
        body: excerpt(c.body),
        media: await mediaByIds([c.mediaId]),
        meta: [{ label: "Zu Beitrag", value: excerpt(parent?.body, 140) ?? "–" }],
        removed: Boolean(c.deletedAt),
        state: c.deletedAt ? ["entfernt"] : [],
      };
    }
    case "review": {
      const [r] = await db.select().from(reviews).where(eq(reviews.id, id));
      if (!r) return empty(type, id);
      const [target] = await db.select({ username: users.username }).from(users).where(eq(users.id, r.targetId));
      return {
        type,
        id,
        exists: true,
        ownerId: r.authorId,
        heading: `Bericht über @${target?.username ?? "?"}`,
        title: r.title,
        body: excerpt(r.body),
        media: [],
        meta: [
          { label: "Bewertung", value: `${r.rating} / 5` },
          { label: "Verifiziert", value: r.verified ? "Ja (Buchung)" : "Nein" },
          { label: "Treffen", value: r.meetingDate ?? "–" },
        ],
        removed: r.hidden,
        state: r.hidden ? ["ausgeblendet"] : [],
      };
    }
    case "message": {
      const [m] = await db.select().from(messages).where(eq(messages.id, id));
      if (!m) return empty(type, id);
      const att = await db.select({ mediaId: messageAttachments.mediaId }).from(messageAttachments).where(eq(messageAttachments.messageId, id));
      return {
        type,
        id,
        exists: true,
        ownerId: m.senderId,
        heading: "Private Nachricht",
        body: excerpt(m.body),
        media: await mediaByIds(att.map((a) => a.mediaId)),
        meta: [
          { label: "Typ", value: m.type },
          { label: "Unterhaltung", value: m.conversationId.slice(0, 8) },
        ],
        removed: Boolean(m.deletedAt),
        state: m.deletedAt ? ["entfernt"] : [],
      };
    }
    case "story": {
      const [s] = await db.select().from(stories).where(eq(stories.id, id));
      if (!s) return empty(type, id);
      return {
        type,
        id,
        exists: true,
        ownerId: s.authorId,
        heading: s.highlight ? `Story-Highlight${s.highlightTitle ? `: ${s.highlightTitle}` : ""}` : "Story",
        body: s.overlayText,
        media: await mediaByIds([s.mediaId]),
        meta: [{ label: "Läuft ab", value: s.expiresAt.toLocaleString("de-CH", { timeZone: "Europe/Zurich" }) }],
        removed: false,
        state: s.expiresAt < new Date() && !s.highlight ? ["abgelaufen"] : [],
      };
    }
    case "group": {
      const [g] = await db.select().from(groups).where(eq(groups.id, id));
      if (!g) return empty(type, id);
      return {
        type,
        id,
        exists: true,
        ownerId: g.ownerId,
        heading: `Gruppe «${g.name}»`,
        body: excerpt([g.description, g.rules ? `Regeln: ${g.rules}` : null].filter(Boolean).join("\n\n")),
        media: await mediaByIds([g.coverMediaId]),
        meta: [
          { label: "Privatsphäre", value: g.privacy },
          { label: "Mitglieder", value: String(g.memberCount) },
        ],
        removed: false,
        state: [],
      };
    }
    case "thread": {
      const [t] = await db
        .select({ thread: forumThreads, category: forumCategories.name })
        .from(forumThreads)
        .leftJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
        .where(eq(forumThreads.id, id));
      if (!t) return empty(type, id);
      const [first] = await db.select({ body: posts.body }).from(posts).where(eq(posts.threadId, id)).orderBy(asc(posts.createdAt)).limit(1);
      return {
        type,
        id,
        exists: true,
        ownerId: t.thread.authorId,
        heading: `Thread in «${t.category ?? "?"}»`,
        title: t.thread.title,
        body: excerpt(first?.body),
        media: [],
        meta: [
          { label: "Antworten", value: String(t.thread.replyCount) },
          { label: "Angepinnt", value: t.thread.pinned ? "Ja" : "Nein" },
        ],
        removed: t.thread.locked,
        state: t.thread.locked ? ["geschlossen"] : [],
      };
    }
    case "media": {
      const [m] = await db.select().from(media).where(eq(media.id, id));
      if (!m) return empty(type, id);
      return {
        type,
        id,
        exists: true,
        ownerId: m.ownerId,
        heading: `Medium (${m.purpose})`,
        media: [toPreviewMedia(m)],
        meta: [
          { label: "Typ", value: `${m.kind} · ${m.mime}` },
          { label: "Grösse", value: `${Math.round(m.sizeBytes / 1024)} KB` },
        ],
        removed: m.status === "rejected",
        state: m.status === "rejected" ? ["abgelehnt"] : [],
      };
    }
  }
}

async function profilePreview(id: string): Promise<TargetPreview> {
  const [row] = await db
    .select({ u: users, escortName: escortProfiles.displayName, about: escortProfiles.about, birthDate: escortProfiles.birthDate, city: escortProfiles.city, clubName: clubProfiles.name, clubSlug: clubProfiles.slug, clubDesc: clubProfiles.description })
    .from(users)
    .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .leftJoin(clubProfiles, eq(clubProfiles.userId, users.id))
    .where(eq(users.id, id));
  if (!row) return empty("profile", id);
  const { u } = row;
  const gallery = await db
    .select()
    .from(media)
    .where(eq(media.ownerId, id))
    .orderBy(asc(media.sortOrder))
    .limit(30);
  const shown = [u.avatarMediaId ? gallery.find((m) => m.id === u.avatarMediaId) : null, ...gallery.filter((m) => m.purpose === "gallery")]
    .filter((m): m is MediaRow => Boolean(m))
    .slice(0, 8);
  return {
    type: "profile",
    id,
    exists: true,
    ownerId: id,
    heading: `Profil @${u.username}`,
    title: row.escortName || row.clubName || u.username,
    body: excerpt(row.about || row.clubDesc || u.bio),
    media: shown.map(toPreviewMedia),
    href: profileHref({ username: u.username, accountType: u.accountType, clubSlug: row.clubSlug }),
    meta: [
      { label: "Kontotyp", value: u.accountType },
      { label: "KYC", value: u.kycStatus },
      ...(row.birthDate ? [{ label: "Geburtsdatum", value: row.birthDate }] : []),
      ...(row.city ? [{ label: "Stadt", value: row.city }] : []),
    ],
    removed: u.profileHidden,
    state: [u.profileHidden ? "ausgeblendet" : null, u.status !== "active" ? u.status : null].filter(Boolean) as string[],
  };
}
