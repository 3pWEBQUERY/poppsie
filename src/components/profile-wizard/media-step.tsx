"use client";

import { useTransition } from "react";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { MediaUploader, type UploadedMedia } from "@/components/shared/media-uploader";
import { deleteProfileMedia, setGlobalBlur, setMediaBlur } from "@/lib/profiles/actions";
import type { MediaValues } from "@/lib/profiles/types";
import { Field, Section } from "./field";
import type { StepProps } from "./types";

export function BlurSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
      <span className="flex gap-3">
        <EyeOff className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Für nicht registrierte Besucher unkenntlich machen</span>
          <span className="text-xs text-muted-foreground">
            Gäste sehen nur eine verpixelte Version. Das Original wird ihnen nie ausgeliefert. Gilt für alle Bilder; einzelne Bilder kannst du mit dem Augen-Symbol umschalten.
          </span>
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label="Für Gäste unkenntlich machen" />
    </label>
  );
}

export function MediaStep({ value, onChange, draft }: StepProps<MediaValues>) {
  const [pending, start] = useTransition();
  const provider = draft.accountType !== "member";
  const isClub = draft.accountType === "club";

  const changeGallery = (next: UploadedMedia[]) => {
    const removed = value.gallery.filter((m) => !next.some((n) => n.id === m.id)).map((m) => m.id);
    onChange({ ...value, gallery: next });
    if (removed.length) {
      start(async () => {
        const res = await deleteProfileMedia(removed);
        if (!res.ok) toast.error(res.error);
      });
    }
  };

  const toggleGlobal = (blur: boolean) =>
    start(async () => {
      const res = await setGlobalBlur(blur, true);
      if (res.ok) onChange({ ...value, ...res.data });
      else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={isClub ? "Logo / Profilbild" : "Profilbild"} required={provider} hint={provider ? "Quadratisch wirkt am besten." : "Optional."}>
          <MediaUploader
            purpose="avatar"
            value={value.avatar ? [value.avatar] : []}
            onChange={(list) => onChange({ ...value, avatar: (list[list.length - 1] as UploadedMedia | undefined) ?? null })}
            max={1}
            accept="image/*"
            blurToggle={provider}
            defaultBlur={value.blurForGuests}
            onBlurChange={(id, blur) => start(async () => void (await setMediaBlur(id, blur)))}
            label="Bild wählen"
            className="max-w-48 [&>div]:grid-cols-1 [&>div]:sm:grid-cols-1"
          />
        </Field>
        {draft.accountType !== "escort" && (
          <Field label="Titelbild" hint="Breites Bild für den Kopfbereich deines Profils.">
            <MediaUploader
              purpose="cover"
              value={value.cover ? [value.cover] : []}
              onChange={(list) => onChange({ ...value, cover: (list[list.length - 1] as UploadedMedia | undefined) ?? null })}
              max={1}
              accept="image/*"
              blurToggle={provider}
              defaultBlur={value.blurForGuests}
              onBlurChange={(id, blur) => start(async () => void (await setMediaBlur(id, blur)))}
              label="Titelbild wählen"
              className="[&>div]:grid-cols-1 [&>div]:sm:grid-cols-1 [&>div>*]:aspect-[3/1]"
            />
          </Field>
        )}
      </div>

      {provider && (
        <>
          <BlurSwitch checked={value.blurForGuests} onChange={toggleGlobal} disabled={pending} />
          <Section title={`Galerie (${value.gallery.length}/50)`}>
            <p className="-mt-1 text-xs text-muted-foreground">
              {draft.accountType === "escort" ? "Mindestens 3 Fotos. " : ""}Bilder und Videos (max. 60 Sekunden). Reihenfolge mit den Pfeilen ändern. GPS- und EXIF-Daten werden automatisch entfernt.
            </p>
            <MediaUploader
              purpose="gallery"
              value={value.gallery}
              onChange={changeGallery}
              max={50}
              blurToggle
              defaultBlur={value.blurForGuests}
              onBlurChange={(id, blur) =>
                start(async () => {
                  const res = await setMediaBlur(id, blur);
                  if (!res.ok) toast.error(res.error);
                })
              }
            />
          </Section>
        </>
      )}
    </div>
  );
}
