"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { PublicMedia } from "@/lib/profiles/public";

/** Vollbild-Lightbox mit Pfeilen (auch Tastatur) und Zähler. */
export function Lightbox({ items, index, onIndex, onClose, name }: { items: PublicMedia[]; index: number | null; onIndex: (i: number) => void; onClose: () => void; name: string }) {
  const open = index !== null;
  const m = index !== null ? items[index] : undefined;
  const go = (d: number) => index !== null && onIndex((index + d + items.length) % items.length);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
        >
          <DialogPrimitive.Title className="sr-only">Galerie von {name}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Bild {(index ?? 0) + 1} von {items.length}
          </DialogPrimitive.Description>
          {m && <LightboxMedia m={m} name={name} />}
          <div className="absolute top-3 left-4 text-sm text-white/80 tabular-nums">
            {(index ?? 0) + 1} / {items.length}
          </div>
          <DialogPrimitive.Close aria-label="Schliessen" className="absolute top-2 right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="size-5" />
          </DialogPrimitive.Close>
          {items.length > 1 && (
            <>
              <button type="button" aria-label="Vorheriges Bild" onClick={() => go(-1)} className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6">
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" aria-label="Nächstes Bild" onClick={() => go(1)} className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6">
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function LightboxMedia({ m, name }: { m: PublicMedia; name: string }) {
  if (m.kind === "video") {
    if (!m.full) return <MembersOnly />;
    return <video key={m.id} src={m.full} controls autoPlay playsInline className="max-h-[88vh] max-w-[92vw]" />;
  }
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={m.id} src={m.full ?? m.thumb} alt={name} className="max-h-[88vh] max-w-[92vw] object-contain select-none" draggable={false} onContextMenu={(e) => e.preventDefault()} />
      {m.blurred && (
        <div className="absolute inset-0 flex items-center justify-center">
          <MembersOnly />
        </div>
      )}
    </div>
  );
}

export function MembersOnly({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-black/70 px-4 py-3 text-center text-white">
      <Lock className={compact ? "size-4" : "size-6"} />
      <p className={compact ? "text-[11px] font-semibold" : "text-sm font-semibold"}>Nur für Mitglieder sichtbar</p>
      {!compact && (
        <Link href="/registrieren" className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover">
          Kostenlos anmelden
        </Link>
      )}
    </div>
  );
}
