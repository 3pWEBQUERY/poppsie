import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, escortProfiles, forumCategories, forumThreads, groupMembers, groups, media, posts, postMedia, stories, users } from "@/db/schema";
import { isStaff } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { readableCategoryIds } from "@/lib/forum/access";
import { mediaUrl, variantFor } from "@/lib/media/urls";
import { getSummaries } from "@/lib/users/summary";
import { visibleToSql } from "@/lib/visibility";
import { parsePoppsieLink, type LinkRef } from "./links";
import type { EmbedPreview, EmbedRef } from "./types";
import { audienceSql, livePostSql } from "./visibility";

const TYPE_LABEL = { profile: "Profil", thread: "Forum-Thema", post: "Beitrag", group: "Gruppe", highlight: "Story-Highlight" } as const;
const ACCOUNT_LABEL = { escort: "Escort", club: "Club", member: "Mitglied" } as const;

export function ownHosts() {
  const hosts = new Set<string>(["localhost:3000"]);
  try {
    hosts.add(new URL(env.appUrl).host);
  } catch {}
  return [...hosts];
}

const excerpt = (s: string, n = 180) => {
  const t = s.replace(/\*\*|\*/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Link (aus Composer oder "Teilen in…") in eine Einbettung mit ID auflösen. */
export async function refFromLink(ref: LinkRef): Promise<EmbedRef | null> {
  if (ref.by === "id") return { type: ref.type, id: ref.key };
  if (ref.type === "profile") {
    if (ref.by === "club") {
      const [c] = await db.select({ id: clubProfiles.userId }).from(clubProfiles).where(eq(clubProfiles.slug, ref.key));
      if (c) return { type: "profile", id: c.id };
    }
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.username, ref.key));
    return u ? { type: "profile", id: u.id } : null;
  }
  if (ref.type === "group") {
    const [g] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, ref.key));
    return g ? { type: "group", id: g.id } : null;
  }
  return null;
}

export async function refFromUrl(url: string) {
  const ref = parsePoppsieLink(url, ownHosts());
  return ref ? refFromLink(ref) : null;
}

const unavailable = (r: EmbedRef): EmbedPreview => ({ ...r, available: false, title: "Inhalt nicht verfügbar", href: "#", label: TYPE_LABEL[r.type] });

/** Vorschaukarten für Einbettungen; nicht sichtbare Inhalte erscheinen als "nicht verfügbar". */
export async function resolveEmbeds(refs: EmbedRef[], viewer: SessionUser | null, countries: string[]): Promise<Map<string, EmbedPreview>> {
  const out = new Map<string, EmbedPreview>();
  const key = (r: EmbedRef) => `${r.type}:${r.id}`;
  const uuid = /^[0-9a-f-]{36}$/i;
  const by = (t: EmbedRef["type"]) => [...new Set(refs.filter((r) => r.type === t && uuid.test(r.id)).map((r) => r.id))];
  const guest = !viewer;

  const profileIds = by("profile");
  if (profileIds.length) {
    const visible = await db
      .select({ id: users.id, bio: users.bio, escortCity: escortProfiles.city, clubCity: clubProfiles.city, coverId: users.coverMediaId })
      .from(users)
      .leftJoin(escortProfiles, eq(escortProfiles.userId, users.id))
      .leftJoin(clubProfiles, eq(clubProfiles.userId, users.id))
      .where(and(inArray(users.id, profileIds), visibleToSql(users.id, viewer?.id ?? null, countries)));
    const sums = await getSummaries(
      visible.map((v) => v.id),
      viewer,
    );
    for (const v of visible) {
      const s = sums.get(v.id);
      if (!s) continue;
      out.set(key({ type: "profile", id: v.id }), {
        type: "profile",
        id: v.id,
        available: true,
        title: s.name,
        subtitle: [ACCOUNT_LABEL[s.accountType], v.escortCity ?? v.clubCity].filter(Boolean).join(" · "),
        excerpt: v.bio ? excerpt(v.bio, 140) : null,
        imageUrl: s.avatarUrl,
        href: s.href,
        label: TYPE_LABEL.profile,
      });
    }
  }

  const threadIds = by("thread");
  if (threadIds.length) {
    const readable = await readableCategoryIds(viewer, { includeGroups: true });
    const rows = readable.length
      ? await db
          .select({ id: forumThreads.id, title: forumThreads.title, replies: forumThreads.replyCount, cat: forumCategories.name })
          .from(forumThreads)
          .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
          .where(and(inArray(forumThreads.id, threadIds), inArray(forumThreads.categoryId, readable), visibleToSql(forumThreads.authorId, viewer?.id ?? null, countries)))
      : [];
    const first = rows.length
      ? await db
          .selectDistinctOn([posts.threadId], { threadId: posts.threadId, body: posts.body })
          .from(posts)
          .where(and(inArray(posts.threadId, rows.map((r) => r.id)), isNull(posts.deletedAt)))
          .orderBy(posts.threadId, asc(posts.createdAt))
      : [];
    const bodies = new Map(first.map((f) => [f.threadId, f.body]));
    for (const r of rows) {
      out.set(key({ type: "thread", id: r.id }), {
        type: "thread",
        id: r.id,
        available: true,
        title: r.title,
        subtitle: `${r.cat} · ${r.replies} ${r.replies === 1 ? "Antwort" : "Antworten"}`,
        excerpt: bodies.get(r.id) ? excerpt(bodies.get(r.id)!) : null,
        href: `/forum/thread/${r.id}`,
        label: TYPE_LABEL.thread,
      });
    }
  }

  const postIds = by("post");
  if (postIds.length) {
    const rows = await db
      .select({ id: posts.id, authorId: posts.authorId, body: posts.body, context: posts.context, groupId: posts.groupId, threadId: posts.threadId })
      .from(posts)
      .where(and(inArray(posts.id, postIds), livePostSql(viewer?.id ?? null, countries), eq(posts.approved, true), audienceSql(viewer?.id ?? null)));
    const groupIds = rows.filter((r) => r.groupId).map((r) => r.groupId!);
    const okGroups = new Set<string>();
    if (groupIds.length) {
      const gs = await db.select({ id: groups.id, privacy: groups.privacy }).from(groups).where(inArray(groups.id, groupIds));
      const mine = viewer
        ? await db
            .select({ g: groupMembers.groupId })
            .from(groupMembers)
            .where(and(eq(groupMembers.userId, viewer.id), eq(groupMembers.status, "active"), inArray(groupMembers.groupId, groupIds)))
        : [];
      const mineSet = new Set(mine.map((m) => m.g));
      for (const g of gs) if (g.privacy === "public" || mineSet.has(g.id) || isStaff(viewer)) okGroups.add(g.id);
    }
    const visible = rows.filter((r) => r.context === "feed" || (r.groupId && okGroups.has(r.groupId)));
    const sums = await getSummaries(
      visible.map((r) => r.authorId),
      viewer,
    );
    const thumbs = visible.length
      ? await db
          .selectDistinctOn([postMedia.postId], { postId: postMedia.postId, id: media.id, kind: media.kind, blur: media.blurForGuests })
          .from(postMedia)
          .innerJoin(media, eq(media.id, postMedia.mediaId))
          .where(inArray(postMedia.postId, visible.map((r) => r.id)))
          .orderBy(postMedia.postId, asc(postMedia.sortOrder))
      : [];
    const thumbBy = new Map(thumbs.filter((t) => t.kind === "image").map((t) => [t.postId, mediaUrl(t.id, variantFor({ blurForGuests: t.blur, isGuest: guest, wanted: "t" }))]));
    for (const r of visible) {
      const a = sums.get(r.authorId);
      out.set(key({ type: "post", id: r.id }), {
        type: "post",
        id: r.id,
        available: true,
        title: a?.name ?? "Beitrag",
        subtitle: r.context === "group" ? "Gruppenbeitrag" : "Newsfeed",
        excerpt: r.body ? excerpt(r.body, 220) : null,
        imageUrl: thumbBy.get(r.id) ?? a?.avatarUrl ?? null,
        href: `/feed/${r.id}`,
        label: TYPE_LABEL.post,
      });
    }
  }

  const groupIds = by("group");
  if (groupIds.length) {
    const rows = await db.select().from(groups).where(inArray(groups.id, groupIds));
    const mine = viewer
      ? await db
          .select({ g: groupMembers.groupId, status: groupMembers.status })
          .from(groupMembers)
          .where(and(eq(groupMembers.userId, viewer.id), inArray(groupMembers.groupId, groupIds)))
      : [];
    const status = new Map(mine.map((m) => [m.g, m.status]));
    for (const g of rows) {
      const st = status.get(g.id);
      if (st === "banned" && !isStaff(viewer)) continue;
      if (g.privacy === "secret" && st !== "active" && st !== "invited" && !isStaff(viewer)) continue;
      out.set(key({ type: "group", id: g.id }), {
        type: "group",
        id: g.id,
        available: true,
        title: g.name,
        subtitle: `${g.privacy === "public" ? "Öffentliche Gruppe" : g.privacy === "private" ? "Private Gruppe" : "Geheime Gruppe"} · ${g.memberCount} Mitglieder`,
        excerpt: g.description ? excerpt(g.description, 160) : null,
        imageUrl: g.coverMediaId ? mediaUrl(g.coverMediaId, "t") : null,
        href: `/gruppen/${g.slug}`,
        label: TYPE_LABEL.group,
      });
    }
  }

  const storyIds = by("highlight");
  if (storyIds.length) {
    const rows = await db
      .select({ id: stories.id, authorId: stories.authorId, title: stories.highlightTitle, mediaId: stories.mediaId, kind: media.kind, blur: media.blurForGuests })
      .from(stories)
      .innerJoin(media, eq(media.id, stories.mediaId))
      .where(and(inArray(stories.id, storyIds), eq(stories.highlight, true), visibleToSql(stories.authorId, viewer?.id ?? null, countries)));
    const sums = await getSummaries(
      rows.map((r) => r.authorId),
      viewer,
    );
    for (const r of rows) {
      const a = sums.get(r.authorId);
      out.set(key({ type: "highlight", id: r.id }), {
        type: "highlight",
        id: r.id,
        available: true,
        title: r.title || "Highlight",
        subtitle: a ? `Highlight von ${a.name}` : null,
        imageUrl: r.kind === "image" ? mediaUrl(r.mediaId, variantFor({ blurForGuests: r.blur, isGuest: guest, wanted: "t" })) : (a?.avatarUrl ?? null),
        href: `/stories/${r.id}`,
        label: TYPE_LABEL.highlight,
      });
    }
  }

  for (const r of refs) if (!out.has(key(r))) out.set(key(r), unavailable(r));
  return out;
}

export const embedKey = (r: EmbedRef) => `${r.type}:${r.id}`;
