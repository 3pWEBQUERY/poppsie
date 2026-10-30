"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { uploadFile, videoDuration, type UploadedMedia } from "@/components/shared/media-uploader";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { UserAvatar } from "@/components/shared/user-avatar";
import { addComment } from "@/lib/content/comment-actions";
import { MAX_COMMENT, type CommentView } from "@/lib/content/types";
import { MentionTextarea } from "./mention-textarea";
import { useContentViewer } from "./viewer-context";

/** Kommentar- bzw. Antwortfeld mit Emoji, einem Bild/Video und @-Erwähnungen. */
export function CommentForm({
  postId,
  parentId,
  onAdded,
  autoFocus,
  placeholder = "Kommentieren …",
  initialText = "",
}: {
  postId: string;
  parentId?: string | null;
  onAdded: (c: CommentView) => void;
  autoFocus?: boolean;
  placeholder?: string;
  initialText?: string;
}) {
  const viewer = useContentViewer();
  const locked = useLockedHandler();
  const [text, setText] = useState(initialText);
  const [file, setFile] = useState<UploadedMedia | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  if (!viewer) return null;

  const send = () => {
    if ((!text.trim() && !file) || pending) return;
    start(async () => {
      const res = await addComment({ postId, parentId: parentId ?? null, body: text, mediaId: file?.id ?? null });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      setText("");
      setFile(null);
      onAdded(res.data);
    });
  };

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const durationSec = f.type.startsWith("video/") ? await videoDuration(f) : undefined;
      setFile(await uploadFile(f, "comment", { durationSec }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-start gap-2">
      <UserAvatar user={viewer} size="xs" className="mt-1" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border bg-background/60 px-3 py-1.5">
        <MentionTextarea
          textareaRef={ref}
          value={text}
          onChange={(v) => setText(v.slice(0, MAX_COMMENT))}
          minRows={1}
          maxHeight={200}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="py-1"
        />
        {file && (
          <div className="relative w-24">
            {file.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.thumbUrl} alt="" className="size-24 rounded-md object-cover" />
            ) : (
              <video src={file.url} className="size-24 rounded-md object-cover" muted />
            )}
            <button type="button" aria-label="Medium entfernen" onClick={() => setFile(null)} className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5">
              <X className="size-3" />
            </button>
          </div>
        )}
        <div className="-mx-1 flex items-center gap-0.5 pb-0.5">
          <EmojiPicker
            onSelect={(e) => {
              const el = ref.current;
              const s = el?.selectionStart ?? text.length;
              setText((t) => (t.slice(0, s) + e + t.slice(s)).slice(0, MAX_COMMENT));
            }}
            triggerClassName="size-7"
          />
          <button
            type="button"
            aria-label="Bild oder Video anhängen"
            disabled={uploading || Boolean(file)}
            onClick={() => input.current?.click()}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </button>
          <input ref={input} type="file" hidden accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button
            type="button"
            aria-label="Senden"
            onClick={send}
            disabled={pending || (!text.trim() && !file)}
            className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-primary hover:bg-accent disabled:text-muted-foreground disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
