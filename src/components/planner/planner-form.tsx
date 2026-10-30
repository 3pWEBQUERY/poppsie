"use client";

import { useState, useTransition } from "react";
import { CircleMinus, Clapperboard, MapPin, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { MediaUploader, type UploadedMedia } from "@/components/shared/media-uploader";
import { Select } from "@/components/shared/select/select";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { timeOptions } from "@/components/bookings/time-options";
import { CANTON_NAMES, SWISS_CANTONS } from "@/lib/geo/countries";
import { CITIES } from "@/lib/geo/cities";
import { createScheduled, updateScheduled } from "@/lib/planner/actions";
import { SEGMENT_LABEL, type PlannerItem, type PlannerType } from "@/lib/planner/types";
import { cn } from "@/lib/utils";

const TIMES = timeOptions(15, false);
const CITY_OPTIONS = CITIES.map((c) => ({ value: c.name, label: c.name, group: CANTON_NAMES[c.region as keyof typeof CANTON_NAMES] ?? c.country }));
const REGION_OPTIONS = SWISS_CANTONS.map((c) => ({ value: c, label: CANTON_NAMES[c] }));
const SEGMENTS = (Object.keys(SEGMENT_LABEL) as (keyof typeof SEGMENT_LABEL)[]).map((k) => ({ value: k, label: SEGMENT_LABEL[k] }));

type Initial = { item?: PlannerItem; date: string; minutes: number };

/** Formular zum Planen/Bearbeiten einer Story, eines Standortwechsels oder eines Broadcasts. */
export function PlannerForm({ initial, timezone, canLocation, onDone, onCancel }: { initial: Initial; timezone: string; canLocation: boolean; onDone: () => void; onCancel: () => void }) {
  const item = initial.item;
  const p = (item?.payload ?? {}) as Record<string, string | undefined>;
  const [type, setType] = useState<PlannerType>(item?.type ?? "story");
  const [date, setDate] = useState(item?.localDate ?? initial.date);
  const [minutes, setMinutes] = useState(item?.localMin ?? initial.minutes);
  const [storyMedia, setStoryMedia] = useState<UploadedMedia[]>(
    item?.type === "story" && p.mediaId ? [{ id: p.mediaId, kind: (p.kind as "image" | "video") ?? "image", thumbUrl: p.thumbUrl ?? "", url: p.thumbUrl ?? "" }] : [],
  );
  const [overlay, setOverlay] = useState(p.overlayText ?? "");
  const [city, setCity] = useState<string | null>(p.city ?? null);
  const [segment, setSegment] = useState<string>(p.segment ?? "followers");
  const [region, setRegion] = useState<string | null>(p.region ?? null);
  const [text, setText] = useState(p.text ?? "");
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

  const submit = () =>
    start(async () => {
      const m = storyMedia[0];
      const payload =
        type === "story"
          ? { mediaId: m?.id, kind: m?.kind === "video" ? "video" : "image", thumbUrl: m?.thumbUrl, overlayText: overlay || undefined }
          : type === "location"
            ? { city }
            : { segment, region: segment === "region" ? region : undefined, text };
      const input = { type, date, minutes, payload };
      const res = item ? await updateScheduled(item.id, input) : await createScheduled(input);
      if (handleLocked(res)) return;
      if (!res.ok) return void toast.error(res.error);
      toast.success(item ? "Änderung gespeichert" : "Aktion geplant");
      onDone();
    });

  const types: { value: PlannerType; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { value: "story", label: "Story", icon: <Clapperboard /> },
    { value: "location", label: "Standort", icon: <MapPin />, disabled: !canLocation },
    { value: "broadcast", label: "Nachricht", icon: <Megaphone /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Art der Aktion">
        {types.map((t) => (
          <button
            key={t.value}
            type="button"
            disabled={t.disabled}
            aria-pressed={type === t.value}
            onClick={() => setType(t.value)}
            title={t.disabled ? "Nur für Escorts" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm font-medium transition-colors disabled:opacity-40 [&_svg]:size-5",
              type === t.value ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-date">Datum</Label>
          <Input id="plan-date" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Uhrzeit</Label>
          <Select options={TIMES} value={String(minutes)} onChange={(v) => setMinutes(Number(v ?? 0))} searchable aria-label="Uhrzeit" />
        </div>
        <p className="col-span-2 -mt-1 text-xs text-muted-foreground">Zeitzone: {timezone}</p>
      </div>

      {type === "story" && (
        <div className="flex flex-col gap-3">
          <Label>Bild oder Video (max. 30 s)</Label>
          <MediaUploader purpose="story" value={storyMedia} onChange={(v) => setStoryMedia(v.slice(-1))} max={1} label="Story-Medium hochladen" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-overlay">Text auf der Story (optional)</Label>
            <Input id="plan-overlay" value={overlay} onChange={(e) => setOverlay(e.target.value)} maxLength={120} placeholder="z. B. Heute ab 18 Uhr frei" />
          </div>
        </div>
      )}

      {type === "location" && (
        <div className="flex flex-col gap-1.5">
          <Label>Neue Stadt</Label>
          <Select options={CITY_OPTIONS} value={city} onChange={setCity} searchable placeholder="Stadt wählen" aria-label="Neue Stadt" />
          <p className="text-xs text-muted-foreground">Dein Profil-Standort wechselt automatisch, deine Follower werden benachrichtigt (z. B. Tour „Ab Mo in Basel“).</p>
        </div>
      )}

      {type === "broadcast" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Empfänger</Label>
            <Select options={SEGMENTS} value={segment} onChange={(v) => setSegment(v ?? "followers")} aria-label="Empfänger" />
          </div>
          {segment === "region" && (
            <div className="flex flex-col gap-1.5">
              <Label>Region</Label>
              <Select options={REGION_OPTIONS} value={region} onChange={setRegion} searchable placeholder="Kanton wählen" aria-label="Region" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-text">Nachricht</Label>
            <Textarea id="plan-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={4} placeholder="z. B. Ab Montag bin ich für drei Tage in Basel – schreib mir!" />
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleMinus className="size-3.5" /> Gegen Spam: höchstens eine Nachricht an Follower pro Tag. Sie kommt als Mitteilung und im Messenger an.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button onClick={submit} disabled={pending}>
          {item ? "Speichern" : "Planen"}
        </Button>
      </div>
    </div>
  );
}
