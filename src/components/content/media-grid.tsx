"use client";

import { useState } from "react";
import { Lock, Play } from "lucide-react";
import type { MediaView } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { Lightbox } from "./lightbox";

function Tile({ m, onOpen, className, more, ratio }: { m: MediaView; onOpen: () => void; className?: string; more?: number; ratio?: number | null }) {
  return (
    <button type="button" onClick={onOpen} style={ratio ? { aspectRatio: String(ratio) } : undefined} className={cn("group relative overflow-hidden bg-muted", className)} aria-label={m.kind === "video" ? "Video öffnen" : "Bild öffnen"}>
      {m.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.thumbUrl} alt="" loading="lazy" draggable={false} className="size-full object-cover transition-opacity group-hover:opacity-90" />
      ) : m.kind === "video" && m.url ? (
        <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-secondary" />
      )}
      {m.kind === "video" && !m.locked && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/60 p-3 text-white">
            <Play className="size-6 fill-current" />
          </span>
        </span>
      )}
      {m.locked && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-xs font-medium text-white">
          <Lock className="size-5" />
          Nur für Mitglieder
        </span>
      )}
      {more ? <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-2xl font-bold text-white">+{more}</span> : null}
    </button>
  );
}

/** Medienraster (1–10 Medien) mit Lightbox. */
export function MediaGrid({ items, className }: { items: MediaView[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) return null;
  const shown = items.slice(0, 4);
  const rest = items.length - shown.length;
  const single = items.length === 1;
  const ratio = single && items[0]!.width && items[0]!.height ? Math.min(Math.max(items[0]!.width / items[0]!.height, 0.75), 1.9) : null;
  return (
    <>
      <div
        className={cn(
          "grid gap-0.5 overflow-hidden rounded-md",
          single ? "grid-cols-1" : "grid-cols-2",
          items.length === 3 && "grid-rows-2",
          className,
        )}
      >
        {shown.map((m, i) => (
          <Tile
            key={m.id}
            m={m}
            onOpen={() => setOpen(i)}
            more={i === 3 && rest > 0 ? rest : undefined}
            ratio={single ? (ratio ?? 4 / 3) : null}
            className={cn(single ? "max-h-[520px] w-full" : "aspect-square", items.length === 3 && i === 0 && "row-span-2 aspect-auto")}
          />
        ))}
      </div>
      <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
