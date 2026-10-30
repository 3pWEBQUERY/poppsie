"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Link2, Quote } from "lucide-react";
import { toast } from "sonner";
import { Composer } from "@/components/content/composer";
import { EmbedCard } from "@/components/content/embed-card";
import { MediaGrid } from "@/components/content/media-grid";
import { copyLink, PostMenu } from "@/components/content/post-menu";
import { ReactionButton, ReactionSummaryButton } from "@/components/content/reactions";
import { formatDateTime } from "@/components/content/relative-time";
import { useContentViewer } from "@/components/content/viewer-context";
import { RichText } from "@/components/shared/rich-text";
import { UserAvatar } from "@/components/shared/user-avatar";
import { deletePost, updatePost } from "@/lib/content/actions";
import type { PostView } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const GENDER: Record<string, { sym: string; label: string; cls: string }> = {
  frau: { sym: "♀", label: "Frau", cls: "text-pink-400" },
  mann: { sym: "♂", label: "Mann", cls: "text-sky-400" },
  trans: { sym: "⚧", label: "Trans", cls: "text-violet-400" },
  divers: { sym: "⚥", label: "Divers", cls: "text-amber-400" },
};
const TYPE_LABEL = { escort: "Escort", club: "Club", member: "Mitglied" } as const;

/** Forum-Beitrag: Autor (Avatar, Name, Geschlecht, Verifiziert, Beitragszahl), Datum, Text, Medien, "Danke", Zitieren. */
export function ForumPost({
  post: initial,
  index,
  opening,
  canReply,
  onQuote,
  onDeleted,
}: {
  post: PostView;
  index: number;
  opening?: boolean;
  canReply: boolean;
  onQuote: (p: PostView) => void;
  onDeleted: (id: string) => void;
}) {
  const viewer = useContentViewer();
  const [post, setPost] = useState(initial);
  const [editing, setEditing] = useState(false);
  const g = post.authorGender ? GENDER[post.authorGender] : null;
  const anchor = `/forum/thread/${post.threadId}?beitrag=${post.id}`;

  return (
    <article id={`p-${post.id}`} className={cn("scroll-mt-32 overflow-hidden rounded-lg border bg-card", opening && "border-t-2 border-t-primary")}>
      <div className="flex flex-col sm:flex-row">
        <aside className="flex items-center gap-3 border-b bg-background/30 p-3 sm:w-40 sm:shrink-0 sm:flex-col sm:items-center sm:border-r sm:border-b-0 sm:p-4 sm:text-center">
          <UserAvatar user={post.author} link size="lg" className="max-sm:[&>span]:size-12" />
          <div className="flex min-w-0 flex-col sm:items-center">
            <span className="flex items-center gap-1">
              <Link href={post.author.href} className="truncate text-sm font-bold hover:underline">
                {post.author.name}
              </Link>
              {g && (
                <span className={cn("text-sm font-bold", g.cls)} title={g.label} aria-label={g.label}>
                  {g.sym}
                </span>
              )}
              {post.author.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verifiziert" />}
            </span>
            <span className="text-[11px] text-muted-foreground">{TYPE_LABEL[post.author.accountType]}</span>
            {post.authorPosts !== undefined && <span className="text-[11px] text-muted-foreground">{post.authorPosts} Beiträge</span>}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <a href={anchor} className="hover:underline" onClick={(e) => {
                e.preventDefault();
                void copyLink(anchor);
              }} title="Link kopieren">
              #{index}
            </a>
            <span>·</span>
            <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
            {post.editedAt && <span>· bearbeitet</span>}
            <div className="ml-auto">
              <PostMenu
                href={anchor}
                loggedIn={Boolean(viewer)}
                canEdit={post.canEdit}
                canDelete={post.canDelete && !opening}
                onEdit={() => setEditing(true)}
                onDelete={async () => {
                  const res = await deletePost(post.id);
                  if (!res.ok) return void toast.error(res.error);
                  onDeleted(post.id);
                }}
                report={{ targetType: "post", targetId: post.id, targetUserId: post.author.id || undefined }}
              />
            </div>
          </div>
          {post.quote && (
            <blockquote className="rounded-md border-l-2 border-l-primary bg-background/50 px-3 py-2 text-[13px]">
              {post.quote.deleted ? (
                <span className="text-muted-foreground italic">Zitierter Beitrag wurde gelöscht.</span>
              ) : (
                <>
                  <a href={`#p-${post.quote.id}`} className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    <Quote className="size-3" /> {post.quote.author?.name ?? "Unbekannt"} schrieb:
                  </a>
                  <RichText text={post.quote.excerpt} className="line-clamp-4 text-muted-foreground" />
                </>
              )}
            </blockquote>
          )}
          {editing ? (
            <Composer
              context="forum"
              threadId={post.threadId}
              submitLabel="Speichern"
              initial={{ body: post.body, media: post.media.map((m) => ({ id: m.id, kind: m.kind, thumbUrl: m.thumbUrl ?? m.url ?? "", url: m.url ?? "" })), embeds: post.embeds }}
              onCancel={() => setEditing(false)}
              onSubmit={async (p) => {
                const res = await updatePost({ id: post.id, body: p.body, mediaIds: p.mediaIds, embeds: p.embeds });
                if (res.ok) {
                  setPost(res.data);
                  setEditing(false);
                }
                return res;
              }}
              className="border-dashed bg-background/40"
            />
          ) : (
            <>
              {post.body && <RichText text={post.body} className="text-sm leading-relaxed break-words" />}
              <MediaGrid items={post.media} className="max-w-xl" />
              {post.embeds.map((e) => (
                <EmbedCard key={`${e.type}:${e.id}`} e={e} className="max-w-xl" />
              ))}
            </>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-2">
            {viewer && canReply ? (
              <ReactionButton targetType="post" targetId={post.id} value={post.reactions} onChange={(r) => setPost((p) => ({ ...p, reactions: r }))} variant="danke" />
            ) : null}
            <ReactionSummaryButton targetType="post" targetId={post.id} value={post.reactions} />
            {viewer && canReply && (
              <button
                type="button"
                onClick={() => onQuote(post)}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Quote className="size-4" /> Zitieren
              </button>
            )}
            <button
              type="button"
              onClick={() => copyLink(anchor)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground", !(viewer && canReply) && "ml-auto")}
            >
              <Link2 className="size-4" /> Link
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
