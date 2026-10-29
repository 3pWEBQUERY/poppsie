import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { and, asc, eq, sql } from "drizzle-orm";
import { MessagesSquare } from "lucide-react";
import { db } from "@/db";
import { forumThreads, groups, posts } from "@/db/schema";
import { ContentViewerProvider } from "@/components/content/viewer-context";
import { RelativeTime } from "@/components/content/relative-time";
import { ForumShell, type Crumb } from "@/components/forum/forum-shell";
import { PollBox } from "@/components/forum/poll-box";
import { ThreadHeader } from "@/components/forum/thread-header";
import { Pagination } from "@/components/forum/thread-list";
import { ThreadReplies } from "@/components/forum/thread-replies";
import { isStaff } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { hydratePosts } from "@/lib/content/hydrate";
import { contentViewer } from "@/lib/content/viewer";
import { canReadCategory, canWriteCategory, isCategoryModerator, moderatedCategoryIds, readableCategoryIds } from "@/lib/forum/access";
import { forumBase, parsePage } from "@/lib/forum/page-data";
import { firstUnread, getThread, isSubscribed, markRead, pageOfPost, pollFor, POSTS_PER_PAGE, relatedThreads, threadPostPage } from "@/lib/forum/queries";
import { viewerCountries, visibleToSql } from "@/lib/visibility";

export async function generateMetadata(props: PageProps<"/forum/thread/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const t = await getThread(id);
  return { title: t ? t.title : "Forum" };
}

export default async function ThreadPage(props: PageProps<"/forum/thread/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const user = await getSessionUser();
  const t = await getThread(id);
  if (!t) notFound();
  const { cats, tree } = await forumBase(user);
  const cat = cats.find((c) => c.id === t.categoryId);
  if (!cat) notFound();
  const parent = cat.parentId ? (cats.find((c) => c.id === cat.parentId) ?? null) : null;
  if (!(await canReadCategory(user, cat, parent))) notFound();
  const countries = await viewerCountries(user);
  if (!user || user.id !== t.authorId) {
    const [visible] = await db.select({ id: forumThreads.id }).from(forumThreads).where(and(eq(forumThreads.id, t.id), visibleToSql(forumThreads.authorId, user?.id ?? null, countries)));
    if (!visible && !isStaff(user)) notFound();
  }

  const base = `/forum/thread/${t.id}`;
  if (typeof sp.beitrag === "string" && /^[0-9a-f-]{36}$/i.test(sp.beitrag)) {
    const [p] = await db.select({ at: posts.createdAt }).from(posts).where(and(eq(posts.id, sp.beitrag), eq(posts.threadId, t.id)));
    if (p) redirect(`${base}?seite=${await pageOfPost(t.id, user, countries, p.at)}#p-${sp.beitrag}`);
  }
  if (sp.ungelesen && user) {
    const fu = await firstUnread(t.id, user, countries);
    if (fu) redirect(`${base}?seite=${fu.page}#p-${fu.id}`);
  }

  const page = parsePage(sp.seite);
  const { rows, total } = await threadPostPage(t.id, user, countries, page);
  const pages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  if (page > pages) redirect(`${base}?seite=${pages}`);

  const moderator = await isCategoryModerator(user, cat);
  const canWrite = await canWriteCategory(user, cat, parent);
  const canReply = canWrite && (!t.locked || moderator);
  const [views, viewer, poll, subscribed, unread, [first]] = await Promise.all([
    hydratePosts(rows, user, { countries, adultOnly: cat.adultOnlyMedia, moderator, authorStats: true }),
    contentViewer(user),
    pollFor(t.id, user?.id ?? null),
    isSubscribed(t.id, user?.id),
    user ? firstUnread(t.id, user, countries) : Promise.resolve(null),
    db.select({ id: posts.id }).from(posts).where(eq(posts.threadId, t.id)).orderBy(asc(posts.createdAt)).limit(1),
  ]);
  const readable = cat.groupId ? [cat.id] : await readableCategoryIds(user);
  const related = await relatedThreads(t, readable, user, countries);

  await db.update(forumThreads).set({ viewCount: sql`${forumThreads.viewCount} + 1` }).where(eq(forumThreads.id, t.id));
  if (user && rows.length) await markRead(t.id, user.id, rows.at(-1)!.createdAt);

  let moveTargets: { value: string; label: string; group?: string }[] = [];
  if (moderator && !cat.groupId) {
    const mine = isStaff(user) ? null : new Set(await moderatedCategoryIds(user!.id));
    moveTargets = cats
      .filter((c) => !c.groupId && c.id !== cat.id && !cats.some((x) => x.parentId === c.id))
      .filter((c) => !mine || mine.has(c.id) || (c.parentId && mine.has(c.parentId)))
      .map((c) => ({ value: c.id, label: c.name, group: cats.find((p) => p.id === c.parentId)?.name }));
  }

  let crumbs: Crumb[];
  if (cat.groupId) {
    const [g] = await db.select({ name: groups.name, slug: groups.slug }).from(groups).where(eq(groups.id, cat.groupId));
    crumbs = [{ label: "Gruppen", href: "/gruppen" }, { label: g?.name ?? "Gruppe", href: `/gruppen/${g?.slug}` }, { label: "Forum", href: `/gruppen/${g?.slug}/forum` }, { label: t.title }];
  } else {
    crumbs = [{ label: "Forum", href: "/forum" }, ...(parent ? [{ label: parent.name, href: `/forum/${parent.slug}` }] : []), { label: cat.name, href: `/forum/${cat.slug}` }, { label: t.title }];
  }
  const writeHint = !user ? null : cat.writeTypes.length || parent?.writeTypes.length ? "In diesem Bereich können nur bestimmte Kontotypen schreiben." : null;

  return (
    <ContentViewerProvider viewer={viewer}>
      <ForumShell tree={tree} active={cat.groupId ? null : cat.slug} crumbs={crumbs}>
        <ThreadHeader
          thread={{ id: t.id, title: t.title, prefix: t.prefix, tags: t.tags, pinned: t.pinned, locked: t.locked, solved: t.solved, authorId: t.authorId, viewCount: t.viewCount + 1, replyCount: t.replyCount }}
          subscribed={subscribed}
          moderator={moderator}
          canReply={canReply}
          moveTargets={moveTargets}
          unreadHref={unread ? `${base}?seite=${unread.page}#p-${unread.id}` : null}
        />
        {poll && <PollBox poll={poll} canVote={Boolean(user) && canWrite && !t.locked} />}
        <Pagination page={page} pages={pages} href={(p) => `${base}?seite=${p}`} />
        <ThreadReplies
          key={page}
          threadId={t.id}
          initial={views}
          offset={(page - 1) * POSTS_PER_PAGE}
          canReply={canReply}
          locked={t.locked}
          firstPostId={first?.id ?? null}
          page={page}
          pages={pages}
          writeHint={writeHint}
        />
        <Pagination page={page} pages={pages} href={(p) => `${base}?seite=${p}`} />
        {related.length > 0 && (
          <section className="rounded-lg border border-l-4 border-l-primary bg-card p-4" aria-label="Ähnliche Themen">
            <h2 className="mb-2 text-sm font-bold">Mehr zu: {t.title}</h2>
            <ul className="flex flex-col divide-y">
              {related.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />
                  <Link href={`/forum/thread/${r.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
                    {r.title}
                  </Link>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {r.category} · {r.replyCount} Antworten · <RelativeTime iso={r.lastPostAt} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </ForumShell>
    </ContentViewerProvider>
  );
}
