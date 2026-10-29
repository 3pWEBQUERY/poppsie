"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, FileText, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import type { AttachmentView } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { viewOnceOpened } from "@/app/(site)/dashboard/nachrichten/actions";
import { duration } from "./format";
import { Lightbox, type LightboxItem } from "./lightbox";

/** Anhänge einer Nachricht: Bilder/Videos als Raster (Lightbox), Sprachnachrichten, PDFs, Einmal-Medien. */
export function Attachments({ messageId, items, mine, onViewed }: { messageId: string; items: AttachmentView[]; mine: boolean; onViewed?: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const visual = items.filter((a) => (a.kind === "image" || a.kind === "video") && !(a.viewOnce && !mine));
  const lightbox: LightboxItem[] = visual.map((a) => ({ kind: a.kind as "image" | "video", src: a.url!, download: !a.viewOnce }));

  return (
    <div className="flex flex-col gap-1.5">
      {visual.length > 0 && (
        <div className={cn("grid gap-1", visual.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {visual.map((a, i) => (
            <button
              key={a.mediaId}
              type="button"
              onClick={() => setOpen(i)}
              className={cn("relative overflow-hidden rounded-md bg-black/30", visual.length === 1 ? "max-h-72" : "aspect-square")}
              aria-label={a.kind === "image" ? "Bild öffnen" : "Video abspielen"}
            >
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumbUrl ?? a.url ?? ""} alt="" loading="lazy" className={cn("size-full object-cover", visual.length === 1 && "max-h-72 w-auto max-w-full")} />
              ) : a.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <video src={a.url ?? undefined} preload="metadata" muted playsInline className={cn("size-full object-cover", visual.length === 1 && "max-h-72")} />
              )}
              {a.kind === "video" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-black/60 p-2.5 text-white">
                    <Play className="size-5 fill-current" />
                  </span>
                </span>
              )}
              {a.viewOnce && (
                <span className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">
                  <Eye className="size-3" /> {a.viewed ? "Geöffnet" : "Einmal ansehen"}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {items
        .filter((a) => a.viewOnce && !mine)
        .map((a) => (
          <ViewOnceTile key={a.mediaId} messageId={messageId} a={a} onViewed={onViewed} />
        ))}
      {items
        .filter((a) => a.kind === "audio")
        .map((a) => (
          <AudioPlayer key={a.mediaId} src={a.url} seconds={a.durationSec} mine={mine} />
        ))}
      {items
        .filter((a) => a.kind === "file")
        .map((a) => (
          <a
            key={a.mediaId}
            href={a.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:underline", mine ? "bg-black/20" : "bg-background/60")}
          >
            <FileText className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{a.fileName ?? "Dokument.pdf"}</span>
            <span className="text-[10px] uppercase opacity-70">PDF</span>
          </a>
        ))}
      {open !== null && <Lightbox items={lightbox} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Einmal-Medium für Empfänger: wird erst beim Antippen geladen (danach serverseitig gesperrt). */
function ViewOnceTile({ messageId, a, onViewed }: { messageId: string; a: AttachmentView; onViewed?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(a.viewed || !a.url);

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const openIt = async () => {
    if (done || !a.url) return;
    setLoading(true);
    try {
      const res = await fetch(a.url, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 410 ? "Dieses Medium wurde bereits angesehen" : "Medium konnte nicht geladen werden");
      setSrc(URL.createObjectURL(await res.blob()));
      setDone(true);
      viewOnceOpened(messageId).finally(() => onViewed?.());
    } catch (e) {
      toast.error((e as Error).message);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openIt}
        disabled={done || loading}
        className="flex items-center gap-2 rounded-md border border-dashed border-current/40 px-3 py-2.5 text-sm disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : done ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {done ? (a.kind === "video" ? "Video angesehen" : "Foto angesehen") : a.kind === "video" ? "Video einmal ansehen" : "Foto einmal ansehen"}
      </button>
      {src && <Lightbox items={[{ kind: a.kind as "image" | "video", src }]} index={0} onClose={() => setSrc(null)} title="Einmal ansehen" />}
    </>
  );
}

/** Kompakter Player für Sprachnachrichten. */
export function AudioPlayer({ src, seconds, mine }: { src: string | null; seconds: number | null; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [len, setLen] = useState(seconds ?? 0);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => toast.error("Wiedergabe nicht möglich"));
    else el.pause();
  };

  return (
    <div className="flex w-56 max-w-full items-center gap-2 py-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? "Pause" : "Abspielen"}
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", mine ? "bg-white text-primary" : "bg-primary text-white")}
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </button>
      <input
        type="range"
        min={0}
        max={len || 1}
        step={0.1}
        value={pos}
        aria-label="Position"
        onChange={(e) => {
          const v = Number(e.target.value);
          if (ref.current) ref.current.currentTime = v;
          setPos(v);
        }}
        className={cn("h-1 flex-1 cursor-pointer", mine ? "accent-white" : "accent-primary")}
      />
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums opacity-80">{duration(playing || pos ? pos : len)}</span>
      {src && (
        <audio
          ref={ref}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setPos(0);
          }}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLen(e.currentTarget.duration)}
        />
      )}
    </div>
  );
}
