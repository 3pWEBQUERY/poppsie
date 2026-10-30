"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export type LightboxItem = { kind: "image" | "video"; src: string; download?: boolean };

/** Vollbild-Ansicht für Bilder und Videos eines Chats (Pfeiltasten blättern, Esc schliesst). */
export function Lightbox({ items, index, onClose, title = "Medien" }: { items: LightboxItem[]; index: number; onClose: () => void; title?: string }) {
  const [i, setI] = useState(index);
  const item = items[i];
  const prev = () => setI((x) => (x - 1 + items.length) % items.length);
  const next = () => setI((x) => (x + 1) % items.length);

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onKeyDown={(e) => {
            if (items.length < 2) return;
            if (e.key === "ArrowLeft") prev();
            if (e.key === "ArrowRight") next();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Vollbildansicht</DialogPrimitive.Description>
          {item?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.src} alt="" draggable={false} className="max-h-[92dvh] max-w-[96vw] object-contain select-none" />
          )}
          {item?.kind === "video" && <video key={item.src} src={item.src} controls autoPlay playsInline className="max-h-[92dvh] max-w-[96vw]" />}
          <div className="absolute top-3 right-3 flex gap-2">
            {item?.download && (
              <a href={item.src} download aria-label="Herunterladen" className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <Download className="size-5" />
              </a>
            )}
            <DialogPrimitive.Close aria-label="Schliessen" className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          {items.length > 1 && (
            <>
              <button type="button" aria-label="Vorheriges" onClick={prev} className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" aria-label="Nächstes" onClick={next} className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <ChevronRight className="size-6" />
              </button>
              <span className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                {i + 1} / {items.length}
              </span>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
