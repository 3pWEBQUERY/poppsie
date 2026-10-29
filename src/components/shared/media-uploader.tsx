"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, EyeOff, ImagePlus, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type UploadedMedia = { id: string; kind: "image" | "video" | "audio" | "file"; thumbUrl: string; url: string; fileName?: string | null; blurForGuests?: boolean };
type Pending = { key: string; name: string; progress: number };

export type Purpose = "gallery" | "avatar" | "cover" | "logo" | "post" | "message" | "story" | "comment" | "group";

/** Videodauer im Browser ermitteln (Server prüft die Grenze). */
export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(Math.round(v.duration || 0));
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

/** Upload mit Fortschritt (XHR), gibt das Medienobjekt der API zurück. */
export function uploadFile(file: File, purpose: Purpose, opts: { blurForGuests?: boolean; durationSec?: number; onProgress?: (p: number) => void } = {}) {
  return new Promise<UploadedMedia>((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("purpose", purpose);
    if (opts.blurForGuests !== undefined) fd.append("blurForGuests", String(opts.blurForGuests));
    if (opts.durationSec !== undefined) fd.append("durationSec", String(opts.durationSec));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return {};
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ...body, blurForGuests: opts.blurForGuests });
      else reject(new Error(body.error ?? "Upload fehlgeschlagen"));
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
    xhr.send(fd);
  });
}

/**
 * Medien-Uploader: Drag & Drop, Mehrfachauswahl, Fortschrittsbalken, Reihenfolge ändern.
 * Optional pro Medium "für Gäste unkenntlich machen".
 */
export function MediaUploader({
  purpose,
  value,
  onChange,
  max = 10,
  accept = "image/*,video/mp4,video/webm,video/quicktime",
  blurToggle = false,
  defaultBlur = false,
  onBlurChange,
  className,
  label = "Bilder oder Videos hinzufügen",
}: {
  purpose: Purpose;
  value: UploadedMedia[];
  onChange: (v: UploadedMedia[]) => void;
  max?: number;
  accept?: string;
  blurToggle?: boolean;
  defaultBlur?: boolean;
  onBlurChange?: (id: string, blur: boolean) => void;
  className?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const latest = useRef(value);
  latest.current = value;

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, Math.max(0, max - value.length - pending.length));
    if (list.length === 0) {
      toast.error(`Maximal ${max} Dateien`);
      return;
    }
    await Promise.all(
      list.map(async (file) => {
        const key = `${file.name}-${Math.random()}`;
        setPending((p) => [...p, { key, name: file.name, progress: 0 }]);
        try {
          const durationSec = file.type.startsWith("video/") ? await videoDuration(file) : undefined;
          const m = await uploadFile(file, purpose, {
            blurForGuests: blurToggle ? defaultBlur : undefined,
            durationSec,
            onProgress: (progress) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))),
          });
          onChange([...latest.current, m]);
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setPending((p) => p.filter((x) => x.key !== key));
        }
      }),
    );
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((m, i) => (
          <div key={m.id} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
            {m.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.thumbUrl} alt="" className="size-full object-cover" />
            ) : m.kind === "video" ? (
              <div className="flex size-full items-center justify-center">
                <Play className="size-8 text-muted-foreground" />
              </div>
            ) : (
              <div className="flex size-full items-center justify-center p-2 text-center text-xs">{m.fileName}</div>
            )}
            <div className="absolute inset-x-0 top-0 flex justify-between p-1">
              {blurToggle ? (
                <button
                  type="button"
                  aria-pressed={m.blurForGuests}
                  aria-label="Für Gäste unkenntlich machen"
                  title="Für nicht registrierte Besucher unkenntlich machen"
                  onClick={() => {
                    const blur = !m.blurForGuests;
                    onChange(value.map((x) => (x.id === m.id ? { ...x, blurForGuests: blur } : x)));
                    onBlurChange?.(m.id, blur);
                  }}
                  className={cn("rounded-full p-1", m.blurForGuests ? "bg-primary text-white" : "bg-background/80 text-foreground")}
                >
                  <EyeOff className="size-3.5" />
                </button>
              ) : (
                <span />
              )}
              <button type="button" aria-label="Entfernen" onClick={() => onChange(value.filter((x) => x.id !== m.id))} className="rounded-full bg-background/80 p-1">
                <X className="size-3.5" />
              </button>
            </div>
            {value.length > 1 && (
              <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" aria-label="Nach vorne" onClick={() => move(i, -1)} className="rounded-full bg-background/80 p-1 disabled:opacity-30" disabled={i === 0}>
                  <ArrowLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Nach hinten"
                  onClick={() => move(i, 1)}
                  className="rounded-full bg-background/80 p-1 disabled:opacity-30"
                  disabled={i === value.length - 1}
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.key} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border bg-muted p-3">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <Progress value={p.progress} />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">{p.name}</span>
          </div>
        ))}
        {value.length + pending.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed p-2 text-center text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground",
              dragOver && "border-primary text-foreground",
            )}
          >
            <ImagePlus className="size-6" />
            {label}
          </button>
        )}
      </div>
      <input ref={input} type="file" hidden multiple={max > 1} accept={accept} onChange={(e) => e.target.files && handleFiles(e.target.files)} />
    </div>
  );
}
