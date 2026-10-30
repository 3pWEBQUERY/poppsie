"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Globe, Lock, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { RichText } from "@/components/shared/rich-text";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { deletePost, updatePost } from "@/lib/content/actions";
import { VISIBILITY_LABELS, type PostView } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { CommentSection } from "./comments";
import { Composer } from "./composer";
import { EmbedCard } from "./embed-card";
import { MediaGrid } from "./media-grid";
import { PostMenu } from "./post-menu";
import { ReactionButton, ReactionSummaryButton } from "./reactions";
import { RelativeTime } from "./relative-time";
import { ShareButton } from "./share-dialog";
import { useContentViewer } from "./viewer-context";

const VIS_ICON = { public: Globe, followers: Users, members: Lock } as const;
const TYPE_LABEL = { escort: "Escort", club: "Club", member: "" } as const;

/** Beitragskarte für Feed und Gruppen (Avatar → Profil, Medien mit Lightbox, Einbettungen, Kommentare). */
export function PostCard({
  post: initial,
  onDeleted,
  commentsOpen = false,
  context,
  canInteract = true,
}: {
  post: PostView;
  onDeleted?: (id: string) => void;
  commentsOpen?: boolean;
  /** Zusätzliche Zeile, z. B. "in Gruppe X". */
  context?: React.ReactNode;
  canInteract?: boolean;
}) {
  const viewer = useContentViewer();
  const [post, setPost] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [showComments, setShowComments] = useState(commentsOpen);
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;
  const Vis = VIS_ICON[post.visibility];
  const interact = Boolean(viewer) && canInteract && post.approved;

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4" id={`p-${post.id}`}>
      <header className="flex items-start gap-3">
        <UserAvatar user={post.author} link size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link href={post.author.href} className="truncate text-sm font-semibold hover:underline">
              {post.author.name}
            </Link>
            {post.author.verified && <BadgeCheck className="size-4 text-primary" aria-label="Verifiziert" />}
            {TYPE_LABEL[post.author.accountType] && <span className="text-[11px] text-muted-foreground">· {TYPE_LABEL[post.author.accountType]}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link href={post.href} className="hover:underline">
              <RelativeTime iso={post.createdAt} />
            </Link>
            {post.context === "feed" && (
              <span title={VISIBILITY_LABELS[post.visibility]} className="inline-flex items-center">
                · <Vis className="ml-1 size-3" aria-label={VISIBILITY_LABELS[post.visibility]} />
              </span>
            )}
            {post.editedAt && <span title={new Date(post.editedAt).toLocaleString("de-CH")}>· bearbeitet</span>}
            {context}
          </div>
        </div>
        {!post.approved && (
          <Badge variant="warning" className="shrink-0">
            <Clock /> Wartet auf Freigabe
          </Badge>
        )}
        <PostMenu
          href={post.href}
          share={post.context !== "forum" && post.approved ? { type: "post", id: post.id } : undefined}
          loggedIn={Boolean(viewer)}
          canEdit={post.canEdit}
          canDelete={post.canDelete}
          onEdit={() => setEditing(true)}
          onDelete={async () => {
            const res = await deletePost(post.id);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Beitrag gelöscht");
            setDeleted(true);
            onDeleted?.(post.id);
          }}
          report={{ targetType: "post", targetId: post.id, targetUserId: post.author.id || undefined }}
        />
      </header>

      {editing ? (
        <Composer
          context={post.context}
          groupId={post.groupId}
          submitLabel="Speichern"
          showVisibility={post.context === "feed"}
          initial={{
            body: post.body,
            media: post.media.map((m) => ({ id: m.id, kind: m.kind, thumbUrl: m.thumbUrl ?? m.url ?? "", url: m.url ?? "" })),
            embeds: post.embeds,
            visibility: post.visibility,
          }}
          onCancel={() => setEditing(false)}
          onSubmit={async (p) => {
            const res = await updatePost({ id: post.id, body: p.body, mediaIds: p.mediaIds, embeds: p.embeds, visibility: p.visibility });
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
          <MediaGrid items={post.media} />
          {post.embeds.length > 0 && (
            <div className="flex flex-col gap-2">
              {post.embeds.map((e) => (
                <EmbedCard key={`${e.type}:${e.id}`} e={e} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <ReactionSummaryButton targetType="post" targetId={post.id} value={post.reactions} />
        {post.commentCount > 0 && (
          <button type="button" onClick={() => setShowComments((s) => !s)} className="ml-auto hover:underline">
            {post.commentCount} {post.commentCount === 1 ? "Kommentar" : "Kommentare"}
          </button>
        )}
      </div>

      <div className="-mx-1 flex items-center gap-1 border-t pt-2">
        {interact ? (
          <ReactionButton targetType="post" targetId={post.id} value={post.reactions} onChange={(r) => setPost((p) => ({ ...p, reactions: r }))} />
        ) : (
          !viewer && (
            <Link href="/anmelden" className="inline-flex h-8 items-center px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Anmelden zum Reagieren
            </Link>
          )
        )}
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground", showComments && "text-foreground")}
          aria-expanded={showComments}
        >
          <MessageCircle className="size-4" /> Kommentieren
        </button>
        {viewer && post.approved && post.context !== "forum" && <ShareButton embed={{ type: "post", id: post.id }} className="ml-auto h-8 text-xs" />}
      </div>

      {showComments && (
        <CommentSection postId={post.id} canInteract={interact} onCountChange={(d) => setPost((p) => ({ ...p, commentCount: Math.max(0, p.commentCount + d) }))} />
      )}
    </article>
  );
}
