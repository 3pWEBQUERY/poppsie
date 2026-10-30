import Link from "next/link";
import { CalendarCheck, MapPin, Sparkles } from "lucide-react";
import type { Sticker } from "@/lib/stories/types";
import { cn } from "@/lib/utils";

/** Ein Sticker (Stadt, "Heute verfügbar", Link zum Buchen); Position in Prozent der Story-Fläche. */
export function StickerChip({ s, bookHref, interactive = true, className }: { s: Sticker; bookHref?: string | null; interactive?: boolean; className?: string }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap select-none";
  if (s.type === "city")
    return (
      <span className={cn(base, "bg-white text-black", className)}>
        <MapPin className="size-3.5 text-primary" /> {s.value || "Stadt"}
      </span>
    );
  if (s.type === "available_today")
    return (
      <span className={cn(base, "bg-success text-white", className)}>
        <Sparkles className="size-3.5" /> Heute verfügbar
      </span>
    );
  const content = (
    <>
      <CalendarCheck className="size-3.5" /> {s.value || "Jetzt buchen"}
    </>
  );
  if (interactive && bookHref)
    return (
      <Link href={bookHref} className={cn(base, "bg-primary text-primary-foreground hover:bg-primary-hover", className)} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        {content}
      </Link>
    );
  return <span className={cn(base, "bg-primary text-primary-foreground", className)}>{content}</span>;
}

export function StickerLayer({ stickers, bookHref }: { stickers: Sticker[]; bookHref?: string | null }) {
  return (
    <>
      {stickers.map((s, i) => (
        <span key={i} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <StickerChip s={s} bookHref={bookHref} />
        </span>
      ))}
    </>
  );
}

/** Text-Overlay der Story. */
export function OverlayText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("absolute inset-x-6 bottom-28 z-10 text-center text-xl leading-snug font-bold break-words text-white", className)}>
      <span className="box-decoration-clone rounded bg-black/55 px-2 py-0.5">{text}</span>
    </p>
  );
}
