"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/content/relative-time";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { UserAvatar } from "@/components/shared/user-avatar";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { addStoryComment, deleteStoryComment, loadStoryComments } from "@/lib/stories/actions";
import type { StoryCommentView } from "@/lib/stories/types";

/** Kommentare im Bottom-Sheet über der laufenden (pausierten) Story. */
export function StoryCommentsSheet({ storyId, open, onOpenChange, onAdded }: { storyId: string; open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void }) {
  const [list, setList] = useState<StoryCommentView[] | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const locked = useLockedHandler();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadStoryComments(storyId).then((r) => {
      if (!alive) return;
      if (r.ok) setList(r.data);
      else setList([]);
    });
    return () => {
      alive = false;
    };
  }, [open, storyId]);

  const send = () => {
    if (!text.trim()) return;
    start(async () => {
      const res = await addStoryComment({ storyId, body: text });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      setList((l) => [...(l ?? []), res.data]);
      setText("");
      onAdded();
    });
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent size="tall" className="z-[70] mx-auto max-w-lg" onPointerDown={(e) => e.stopPropagation()}>
        <BottomSheetHeader>
          <BottomSheetTitle>Kommentare</BottomSheetTitle>
        </BottomSheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3">
          {list === null && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted-foreground" />}
          {list?.length === 0 && <p className="mt-6 text-center text-sm text-muted-foreground">Noch keine Kommentare. Schreib den ersten!</p>}
          {list?.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <UserAvatar user={c.author} link size="xs" />
              <div className="min-w-0 flex-1 rounded-2xl bg-secondary/70 px-3 py-2">
                <Link href={c.author.href} className="text-xs font-semibold hover:underline">
                  {c.author.name}
                </Link>
                <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
                <RelativeTime iso={c.createdAt} className="text-[11px] text-muted-foreground" />
              </div>
              {c.canDelete && (
                <button
                  type="button"
                  aria-label="Kommentar löschen"
                  className="mt-2 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    const r = await deleteStoryComment(c.id);
                    if (!r.ok) return void toast.error(r.error);
                    setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <EmojiPicker onSelect={(e) => setText((t) => (t + e).slice(0, 1000))} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Kommentar schreiben …"
            aria-label="Kommentar schreiben"
            className="h-10 flex-1 rounded-full border border-input bg-card px-4 text-sm outline-none focus-visible:border-ring"
          />
          <button type="button" onClick={send} disabled={pending || !text.trim()} aria-label="Senden" className="rounded-full p-2 text-primary disabled:text-muted-foreground">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
          </button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
