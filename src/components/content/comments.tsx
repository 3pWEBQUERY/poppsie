"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RichText } from "@/components/shared/rich-text";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { deleteComment, editComment, loadComments } from "@/lib/content/comment-actions";
import { VISIBLE_DEPTH, type CommentView } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { CommentForm } from "./comment-form";
import { MediaGrid } from "./media-grid";
import { MentionTextarea } from "./mention-textarea";
import { PostMenu } from "./post-menu";
import { ReactionButton, ReactionSummaryButton } from "./reactions";
import { RelativeTime } from "./relative-time";
import { useContentViewer } from "./viewer-context";

/** Verschachtelte Kommentare: max. 3 Ebenen sichtbar, darunter "Weitere Antworten anzeigen". */
export function CommentSection({ postId, canInteract, onCountChange }: { postId: string; canInteract: boolean; onCountChange?: (delta: number) => void }) {
  const viewer = useContentViewer();
  const [list, setList] = useState<CommentView[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadComments(postId).then((res) => {
      if (!alive) return;
      if (res.ok) setList(res.data);
      else {
        toast.error(res.error);
        setList([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [postId]);

  const children = useMemo(() => {
    const m = new Map<string | null, CommentView[]>();
    for (const c of list ?? []) {
      const k = c.parentId ?? null;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [list]);

  const add = (c: CommentView) => {
    setList((l) => [...(l ?? []), c]);
    onCountChange?.(1);
  };
  const update = (c: CommentView) => setList((l) => l?.map((x) => (x.id === c.id ? c : x)) ?? null);
  const remove = (id: string) => {
    setList((l) => l?.map((x) => (x.id === id ? { ...x, deleted: true, body: "", media: null, canEdit: false, canDelete: false } : x)) ?? null);
    onCountChange?.(-1);
  };

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      {viewer && canInteract && <CommentForm postId={postId} onAdded={add} />}
      {!viewer && (
        <p className="text-xs text-muted-foreground">
          <Link href="/anmelden" className="font-semibold text-primary hover:underline">
            Melde dich an
          </Link>{" "}
          um zu kommentieren.
        </p>
      )}
      {list === null ? (
        <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex flex-col gap-3">
          {(children.get(null) ?? []).map((c) => (
            <CommentNode key={c.id} c={c} kids={children} canInteract={canInteract} onAdd={add} onUpdate={update} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

function countDesc(id: string, kids: Map<string | null, CommentView[]>): number {
  return (kids.get(id) ?? []).reduce((n, c) => n + 1 + countDesc(c.id, kids), 0);
}

function CommentNode({
  c,
  kids,
  level = 0,
  canInteract,
  onAdd,
  onUpdate,
  onRemove,
}: {
  c: CommentView;
  kids: Map<string | null, CommentView[]>;
  level?: number;
  canInteract: boolean;
  onAdd: (c: CommentView) => void;
  onUpdate: (c: CommentView) => void;
  onRemove: (id: string) => void;
}) {
  const viewer = useContentViewer();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [reactions, setReactions] = useState(c.reactions);
  const [expanded, setExpanded] = useState(false);
  const [saving, start] = useTransition();
  const replies = kids.get(c.id) ?? [];
  const hidden = level + 1 >= VISIBLE_DEPTH && !expanded;

  const save = () =>
    start(async () => {
      const res = await editComment({ id: c.id, body: draft });
      if (!res.ok) return void toast.error(res.error);
      onUpdate(res.data);
      setEditing(false);
    });

  return (
    <div className="flex gap-2">
      {c.deleted ? <span className="size-7 shrink-0 rounded-full bg-secondary" /> : <UserAvatar user={c.author} link size="xs" className="mt-0.5" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className={cn("w-fit max-w-full rounded-2xl bg-secondary/70 px-3 py-2", editing && "w-full")}>
          {c.deleted ? (
            <p className="text-xs text-muted-foreground italic">Kommentar gelöscht</p>
          ) : (
            <>
              <div className="flex items-center gap-1 text-xs">
                <Link href={c.author.href} className="font-semibold hover:underline">
                  {c.author.name}
                </Link>
                {c.author.verified && <BadgeCheck className="size-3.5 text-primary" aria-label="Verifiziert" />}
              </div>
              {editing ? (
                <div className="mt-1 flex flex-col gap-2">
                  <MentionTextarea value={draft} onChange={setDraft} minRows={2} autoFocus aria-label="Kommentar bearbeiten" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      Abbrechen
                    </Button>
                    <Button size="sm" onClick={save} disabled={saving || !draft.trim()}>
                      Speichern
                    </Button>
                  </div>
                </div>
              ) : (
                c.body && <RichText text={c.body} className="text-sm break-words" />
              )}
            </>
          )}
        </div>
        {c.media && <MediaGrid items={[c.media]} className="max-w-xs" />}
        {!c.deleted && (
          <div className="flex flex-wrap items-center gap-1 pl-1 text-[11px] text-muted-foreground">
            <RelativeTime iso={c.createdAt} />
            {c.editedAt && <span>· bearbeitet</span>}
            {viewer && canInteract && (
              <>
                <ReactionButton targetType="comment" targetId={c.id} value={reactions} onChange={setReactions} variant="compact" className="h-6 px-1.5" />
                <button type="button" onClick={() => setReplying((r) => !r)} className="rounded px-1.5 py-0.5 font-semibold hover:bg-accent hover:text-foreground">
                  Antworten
                </button>
              </>
            )}
            <ReactionSummaryButton targetType="comment" targetId={c.id} value={reactions} />
            <PostMenu
              loggedIn={Boolean(viewer)}
              canEdit={c.canEdit}
              canDelete={c.canDelete}
              onEdit={() => {
                setDraft(c.body);
                setEditing(true);
              }}
              onDelete={async () => {
                const res = await deleteComment(c.id);
                if (!res.ok) return void toast.error(res.error);
                onRemove(c.id);
              }}
              report={{ targetType: "comment", targetId: c.id, targetUserId: c.author.id || undefined }}
              deleteLabel="Kommentar löschen"
            />
          </div>
        )}
        {replying && (
          <CommentForm
            postId={c.postId}
            parentId={c.id}
            autoFocus
            placeholder={`Antwort an ${c.author.name} …`}
            initialText={c.author.username && c.author.id !== viewer?.id ? `@${c.author.username} ` : ""}
            onAdded={(n) => {
              onAdd(n);
              setReplying(false);
              setExpanded(true);
            }}
          />
        )}
        {replies.length > 0 &&
          (hidden ? (
            <button type="button" onClick={() => setExpanded(true)} className="flex w-fit items-center gap-1 pl-1 text-xs font-semibold text-primary hover:underline">
              <ChevronDown className="size-3.5" /> Weitere Antworten anzeigen ({countDesc(c.id, kids)})
            </button>
          ) : (
            <div className={cn("flex flex-col gap-3 pt-1", level < VISIBLE_DEPTH && "border-l border-border pl-3")}>
              {replies.map((r) => (
                <CommentNode key={r.id} c={r} kids={kids} level={level + 1} canInteract={canInteract} onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
