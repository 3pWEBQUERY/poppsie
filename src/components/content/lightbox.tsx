"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { MediaView } from "@/lib/content/types";

/** Vollbild-Ansicht für Bilder und Videos mit Pfeiltasten-Navigation. */
export function Lightbox({ items, index, onIndex, onClose }: { items: MediaView[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const open = index !== null;
  const item = index !== null ? items[index] : null;
  const go = useCallback(
    (d: number) => {
      if (index === null) return;
      onIndex((index + d + items.length) % items.length);
    },
    [index, items.length, onIndex],
  );
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-h-none w-screen max-w-none items-center justify-center border-0 bg-black/95 p-0 sm:max-w-none sm:rounded-none" showCloseButton={false}>
        <DialogTitle className="sr-only">Medienansicht</DialogTitle>
        <button type="button" onClick={onClose} aria-label="Schliessen" className="absolute top-3 right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
          <X className="size-5" />
        </button>
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Vorheriges" className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Nächstes" className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
              <ChevronRight className="size-6" />
            </button>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
              {(index ?? 0) + 1} / {items.length}
            </span>
          </>
        )}
        {item &&
          (item.kind === "video" && item.url ? (
            <video key={item.id} src={item.url} controls autoPlay playsInline className="max-h-[90dvh] max-w-[94vw]" />
          ) : item.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={item.id} src={item.url} alt="" className="max-h-[90dvh] max-w-[94vw] object-contain" draggable={false} />
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/80">
              <Lock className="size-8" />
              <span className="text-sm">Nur für registrierte Mitglieder sichtbar</span>
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}
