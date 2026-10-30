"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Lock, Play } from "lucide-react";
import type { PublicMedia } from "@/lib/profiles/public";
import { cn } from "@/lib/utils";
import { Lightbox, MembersOnly } from "./lightbox";

function Thumb({ m, active, onClick, index }: { m: PublicMedia; active: boolean; onClick: () => void; index: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Bild ${index + 1} anzeigen`}
      aria-current={active}
      className={cn("relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-opacity", active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
    >
      {m.kind === "video" ? (
        <span className="flex size-full items-center justify-center bg-secondary">{m.full ? <Play className="size-5" /> : <Lock className="size-4" />}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.thumb} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
      )}
    </button>
  );
}

/**
 * Grosse Galerie mit Thumbnail-Leiste links (Desktop) bzw. unten (Mobile) und Lightbox.
 * Gäste sehen unkenntlich gemachte Medien nur als Blur-Variante.
 */
export function ProfileGallery({ items, name, fallback }: { items: PublicMedia[]; name: string; fallback?: string | null }) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const m = items[current];

  if (!m) {
    return (
      <div className="flex aspect-[4/5] max-h-[640px] w-full items-center justify-center overflow-hidden rounded-lg border bg-card">
        {fallback ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fallback} alt={name} className="size-full object-cover" />
        ) : (
          <span className="font-display text-6xl font-bold text-muted-foreground">{name.slice(0, 1)}</span>
        )}
      </div>
    );
  }

  const go = (d: number) => setCurrent((c) => (c + d + items.length) % items.length);

  return (
    <div className="flex flex-col-reverse gap-2 md:flex-row">
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 md:max-h-[640px] md:w-20 md:shrink-0 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pr-1 md:pb-0 [scrollbar-width:thin]">
          {items.map((x, i) => (
            <div key={x.id} className="w-16 shrink-0 md:w-full">
              <Thumb m={x} index={i} active={i === current} onClick={() => setCurrent(i)} />
            </div>
          ))}
        </div>
      )}
      <div className="relative aspect-[4/5] max-h-[640px] min-w-0 flex-1 overflow-hidden rounded-lg border bg-card">
        <button type="button" className="block size-full" onClick={() => setLightbox(current)} aria-label="Vollbild öffnen">
          {m.kind === "video" ? (
            m.full ? (
              <video key={m.id} src={m.full} muted playsInline controls className="size-full bg-black object-contain" onClick={(e) => e.stopPropagation()} />
            ) : (
              <span className="flex size-full items-center justify-center bg-secondary">
                <MembersOnly />
              </span>
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.full ?? m.thumb} alt={name} className="size-full object-cover" draggable={false} onContextMenu={(e) => e.preventDefault()} />
          )}
        </button>
        {m.blurred && m.kind === "image" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto">
              <MembersOnly />
            </div>
          </div>
        )}
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums">
          {current + 1} / {items.length}
        </span>
        <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/60 p-1.5 text-white">
          <Expand className="size-4" />
        </span>
        {items.length > 1 && (
          <>
            <button type="button" aria-label="Vorheriges Bild" onClick={() => go(-1)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" aria-label="Nächstes Bild" onClick={() => go(1)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      <Lightbox items={items} index={lightbox} onIndex={(i) => setLightbox(i)} onClose={() => setLightbox(null)} name={name} />
    </div>
  );
}

/** Kompakte Galerie als Raster (Club-Seite), Klick öffnet die Lightbox. */
export function GalleryGrid({ items, name }: { items: PublicMedia[]; name: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!items.length) return <p className="text-sm text-muted-foreground">Noch keine Bilder.</p>;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((m, i) => (
          <button key={m.id} type="button" onClick={() => setLightbox(i)} className="relative aspect-square overflow-hidden rounded-md bg-muted" aria-label={`Bild ${i + 1} öffnen`}>
            {m.kind === "video" ? (
              <span className="flex size-full items-center justify-center bg-secondary">{m.full ? <Play className="size-6" /> : <Lock className="size-5" />}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.thumb} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
            )}
            {m.blurred && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Lock className="size-5 text-white" />
              </span>
            )}
          </button>
        ))}
      </div>
      <Lightbox items={items} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} name={name} />
    </>
  );
}
