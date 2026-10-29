"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, FileText, Loader2, Mic, Paperclip, Pencil, Play, Reply, Send, X } from "lucide-react";
import { toast } from "sonner";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { uploadFile, videoDuration, type UploadedMedia } from "@/components/shared/media-uploader";
import { Progress } from "@/components/ui/progress";
import { MAX_ATTACHMENTS, MAX_BODY, type AttachmentKind, type MessageView } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { fileSize } from "./format";
import { VoiceRecorder } from "./voice-recorder";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,application/pdf";
const MB = 1024 * 1024;

type Pending = {
  key: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  preview: string | null;
  progress: number;
  media: UploadedMedia | null;
  viewOnce: boolean;
};

export type SendInput = { body?: string; attachments?: { mediaId: string; viewOnce?: boolean }[] };

function kindOf(file: File): AttachmentKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type === "application/pdf") return "file";
  return null;
}

function tooBig(file: File, kind: AttachmentKind) {
  if (kind === "video" && file.size > 100 * MB) return "Videos dürfen höchstens 100 MB gross sein";
  if (kind === "image" && file.size > 25 * MB) return "Bilder dürfen höchstens 25 MB gross sein";
  if (kind === "file" && file.size > 25 * MB) return "PDFs dürfen höchstens 25 MB gross sein";
  if (kind === "audio" && file.size > 50 * MB) return "Audiodateien dürfen höchstens 50 MB gross sein";
  return null;
}

export function Composer({
  replyTo,
  editing,
  nameOf,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onTyping,
}: {
  replyTo: MessageView | null;
  editing: MessageView | null;
  nameOf: (id: string) => string;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (input: SendInput) => Promise<boolean>;
  onSaveEdit: (body: string) => Promise<boolean>;
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [saved, setSaved] = useState("");

  // Bearbeiten: Text übernehmen, danach Entwurf wiederherstellen (abgeleiteter Zustand beim Prop-Wechsel).
  if ((editing?.id ?? null) !== editId) {
    setEditId(editing?.id ?? null);
    if (editing) {
      if (!editId) setSaved(text);
      setText(editing.body ?? "");
    } else {
      setText(saved);
      setSaved("");
    }
  }

  useEffect(() => {
    if (replyTo || editing) area.current?.focus();
  }, [replyTo, editing]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [text]);

  useEffect(() => () => pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const uploading = pending.some((p) => !p.media);
  const ready = pending.filter((p) => p.media);
  const canSend = !busy && !uploading && (text.trim().length > 0 || ready.length > 0);

  const upload = async (file: File, opts: { durationSec?: number } = {}) => {
    const kind = kindOf(file);
    if (!kind) {
      toast.error("Dateityp nicht erlaubt");
      return null;
    }
    const big = tooBig(file, kind);
    if (big) {
      toast.error(big);
      return null;
    }
    const key = `${Date.now()}-${Math.random()}`;
    const preview = kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;
    setPending((p) => [...p, { key, name: file.name, size: file.size, kind, preview, progress: 0, media: null, viewOnce: false }]);
    try {
      const durationSec = opts.durationSec ?? (kind === "video" ? await videoDuration(file) : undefined);
      const media = await uploadFile(file, "message", {
        durationSec,
        onProgress: (progress) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))),
      });
      setPending((p) => p.map((x) => (x.key === key ? { ...x, media, progress: 100 } : x)));
      return { key, media };
    } catch (e) {
      toast.error((e as Error).message);
      setPending((p) => p.filter((x) => x.key !== key));
      if (preview) URL.revokeObjectURL(preview);
      return null;
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const room = MAX_ATTACHMENTS - pending.length;
    if (list.length > room) toast.error(`Maximal ${MAX_ATTACHMENTS} Anhänge pro Nachricht`);
    list.slice(0, Math.max(0, room)).forEach((f) => upload(f));
  };

  const remove = (key: string) =>
    setPending((p) => {
      const item = p.find((x) => x.key === key);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return p.filter((x) => x.key !== key);
    });

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      if (editing) {
        if (await onSaveEdit(text.trim())) setText("");
        return;
      }
      const ok = await onSend({ body: text.trim() || undefined, attachments: ready.map((p) => ({ mediaId: p.media!.id, viewOnce: p.viewOnce })) });
      if (ok) {
        setText("");
        pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
        setPending([]);
      }
    } finally {
      setBusy(false);
      requestAnimationFrame(() => area.current?.focus());
    }
  };

  const sendVoice = async (file: File, seconds: number) => {
    const res = await upload(file, { durationSec: seconds });
    if (!res) return;
    const ok = await onSend({ attachments: [{ mediaId: res.media.id }] });
    if (ok) remove(res.key);
  };

  const insertEmoji = (e: string) => {
    const el = area.current;
    if (!el) return setText((t) => t + e);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + e + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + e.length, start + e.length);
    });
  };

  const banner = editing ? (
    <Banner icon={<Pencil className="size-4 text-primary" />} title="Nachricht bearbeiten" text={editing.body ?? ""} onClose={onCancelEdit} />
  ) : replyTo ? (
    <Banner
      icon={<Reply className="size-4 text-primary" />}
      title={`Antwort an ${nameOf(replyTo.senderId)}`}
      text={replyTo.body || (replyTo.attachments.length ? "Anhang" : "")}
      onClose={onCancelReply}
    />
  ) : null;

  return (
    <div
      className="border-t bg-card"
      onDragOver={(e) => {
        if (!editing && e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (editing || !e.dataTransfer.files.length) return;
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      {banner}
      {pending.length > 0 && !editing && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3">
          {pending.map((p) => (
            <div key={p.key} className="relative flex w-24 shrink-0 flex-col gap-1">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
                {p.kind === "image" && p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview} alt="" className="size-full object-cover" />
                ) : p.kind === "video" && p.preview ? (
                  <>
                    <video src={p.preview} muted playsInline preload="metadata" className="size-full object-cover" />
                    <Play className="absolute size-6 fill-white text-white" />
                  </>
                ) : p.kind === "audio" ? (
                  <Mic className="size-6 text-muted-foreground" />
                ) : (
                  <FileText className="size-6 text-muted-foreground" />
                )}
                {!p.media && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </span>
                )}
                <button type="button" aria-label={`${p.name} entfernen`} onClick={() => remove(p.key)} className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white">
                  <X className="size-3.5" />
                </button>
                {(p.kind === "image" || p.kind === "video") && p.media && (
                  <button
                    type="button"
                    aria-pressed={p.viewOnce}
                    onClick={() => setPending((list) => list.map((x) => (x.key === p.key ? { ...x, viewOnce: !x.viewOnce } : x)))}
                    title="Empfänger kann das Medium nur einmal öffnen"
                    className={cn("absolute bottom-1 left-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", p.viewOnce ? "bg-primary text-white" : "bg-black/70 text-white")}
                  >
                    <Eye className="size-3" /> 1×
                  </button>
                )}
              </div>
              {!p.media ? <Progress value={p.progress} /> : <span className="truncate text-[10px] text-muted-foreground">{p.viewOnce ? "Einmal ansehen" : fileSize(p.size)}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1 p-2">
        {!recording && (
          <>
            {!editing && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="Datei anhängen"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Paperclip className="size-5" />
              </button>
            )}
            <EmojiPicker onSelect={insertEmoji} triggerClassName="size-9 shrink-0" />
            <textarea
              ref={area}
              value={text}
              rows={1}
              maxLength={MAX_BODY}
              onChange={(e) => {
                setText(e.target.value);
                if (Date.now() - lastTyping.current > 2500 && e.target.value) {
                  lastTyping.current = Date.now();
                  onTyping();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (editing) onCancelEdit();
                  else if (replyTo) onCancelReply();
                }
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) {
                  e.preventDefault();
                  submit();
                }
              }}
              onPaste={(e) => {
                if (editing) return;
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  addFiles(files);
                }
              }}
              placeholder={editing ? "Nachricht bearbeiten" : "Nachricht schreiben …"}
              aria-label="Nachricht"
              className="max-h-40 min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </>
        )}
        {!editing && !text.trim() && ready.length === 0 && !uploading ? (
          <VoiceRecorder onRecorded={sendVoice} onActiveChange={setRecording} />
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label={editing ? "Änderung speichern" : "Senden"}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        aria-label="Anhänge auswählen"
        hidden
        multiple
        accept={ACCEPT}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Banner({ icon, title, text, onClose }: { icon: React.ReactNode; title: string; text: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b bg-background/40 px-3 py-2">
      {icon}
      <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
        <p className="text-xs font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{text}</p>
      </div>
      <button type="button" aria-label="Abbrechen" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
