"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, MapPin, Send, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { MediaUploader, type UploadedMedia } from "@/components/shared/media-uploader";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CITIES } from "@/lib/geo/cities";
import { publishStory } from "@/lib/stories/actions";
import type { Sticker, StickerType } from "@/lib/stories/types";
import { cn } from "@/lib/utils";
import { OverlayText, StickerChip } from "./story-stickers";

const CITY_OPTIONS = [...new Set(CITIES.map((c) => c.name))].sort((a, b) => a.localeCompare(b, "de")).map((c) => ({ value: c, label: c }));
const DEFAULT_POS: Record<StickerType, { x: number; y: number }> = { city: { x: 30, y: 15 }, available_today: { x: 70, y: 72 }, book_link: { x: 50, y: 84 } };

/** Story-Editor: Bild/Video (max. 30 s), Text-Overlay, verschiebbare Sticker, optional direkt als Highlight. */
export function StoryEditor({ accountType, defaultCity }: { accountType: "escort" | "club"; defaultCity: string | null }) {
  const router = useRouter();
  const locked = useLockedHandler();
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [text, setText] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [city, setCity] = useState<string | null>(defaultCity);
  const [highlight, setHighlight] = useState(false);
  const [hlTitle, setHlTitle] = useState("");
  const [pending, start] = useTransition();
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const m = media[0];

  const has = (t: StickerType) => stickers.some((s) => s.type === t);
  const toggle = (t: StickerType, on: boolean) =>
    setStickers((l) => (on ? [...l.filter((s) => s.type !== t), { type: t, value: t === "city" ? (city ?? undefined) : undefined, ...DEFAULT_POS[t] }] : l.filter((s) => s.type !== t)));

  const move = (e: React.PointerEvent) => {
    if (drag.current === null || !area.current) return;
    const r = area.current.getBoundingClientRect();
    const x = Math.min(92, Math.max(8, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(94, Math.max(6, ((e.clientY - r.top) / r.height) * 100));
    setStickers((l) => l.map((s, i) => (i === drag.current ? { ...s, x: Math.round(x), y: Math.round(y) } : s)));
  };

  const publish = () =>
    start(async () => {
      if (!m) return;
      const res = await publishStory({
        mediaId: m.id,
        overlayText: text || null,
        stickers: stickers.map((s) => (s.type === "city" ? { ...s, value: city ?? undefined } : s)),
        highlightTitle: highlight ? hlTitle || "Highlights" : null,
      });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      toast.success("Story veröffentlicht – 24 Stunden sichtbar");
      setMedia([]);
      setText("");
      setStickers([]);
      setHighlight(false);
      setHlTitle("");
      router.refresh();
    });

  return (
    <div className="grid gap-5 rounded-lg border bg-card p-4 md:grid-cols-[260px_1fr]">
      <div
        ref={area}
        className="relative mx-auto aspect-[9/16] w-full max-w-[260px] touch-none overflow-hidden rounded-xl bg-neutral-900 select-none"
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        {m ? (
          m.kind === "video" ? (
            <video src={m.url} className="size-full object-cover" muted autoPlay loop playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt="" className="size-full object-cover" draggable={false} />
          )
        ) : (
          <span className="flex size-full items-center justify-center p-6 text-center text-xs text-white/60">Vorschau – lade ein Bild oder Video hoch</span>
        )}
        {text && <OverlayText text={text} className="bottom-24 text-base" />}
        {stickers.map((s, i) => (
          <span
            key={s.type}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              drag.current = i;
            }}
            title="Zum Verschieben ziehen"
          >
            <StickerChip s={s.type === "city" ? { ...s, value: city ?? undefined } : s} interactive={false} />
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Bild oder Video (max. 30 Sekunden)</Label>
          <MediaUploader purpose="story" value={media} onChange={(l) => setMedia(l.slice(-1))} max={1} label="Hochladen" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-text">Text-Overlay</Label>
          <Input id="st-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="z. B. Heute in Zürich 💋" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Sticker (in der Vorschau verschiebbar)</Label>
          <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={has("city")} onCheckedChange={(c) => toggle("city", c)} />
              <MapPin className="size-4 text-primary" /> Stadt
            </label>
            {has("city") && <Select options={CITY_OPTIONS} value={city} onChange={setCity} searchable aria-label="Stadt" className="h-8 w-44 text-xs" />}
          </div>
          <label className={cn("flex items-center gap-2 rounded-md border p-3 text-sm")}>
            <Switch checked={has("available_today")} onCheckedChange={(c) => toggle("available_today", c)} />
            <Sparkles className="size-4 text-success" /> „Heute verfügbar“
          </label>
          {accountType === "escort" && (
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Switch checked={has("book_link")} onCheckedChange={(c) => toggle("book_link", c)} />
              <CalendarCheck className="size-4 text-primary" /> Link zum Buchen
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={highlight} onCheckedChange={setHighlight} />
            <Star className="size-4 text-warning" /> Als Highlight im Profil behalten
          </label>
          {highlight && <Input value={hlTitle} onChange={(e) => setHlTitle(e.target.value)} maxLength={40} placeholder="Titel, z. B. Basel" className="h-8 w-48" aria-label="Highlight-Titel" />}
        </div>
        <Button onClick={publish} disabled={!m || pending} className="w-fit">
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Story veröffentlichen
        </Button>
      </div>
    </div>
  );
}
