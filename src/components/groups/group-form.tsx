"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MediaUploader, type UploadedMedia } from "@/components/shared/media-uploader";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CANTON_NAMES, SWISS_CANTONS } from "@/lib/geo/countries";
import { createGroup, updateGroup } from "@/lib/groups/actions";
import { PRIVACY_HINTS, PRIVACY_LABELS, type GroupPrivacy } from "@/lib/groups/types";
import { PRIVACY_ICON } from "./group-card";

export type GroupFormValues = {
  name: string;
  description: string;
  rules: string;
  privacy: GroupPrivacy;
  region: string | null;
  requirePostApproval: boolean;
  cover: UploadedMedia | null;
};

const REGIONS = SWISS_CANTONS.map((c) => ({ value: c, label: CANTON_NAMES[c] })).sort((a, b) => a.label.localeCompare(b.label, "de"));

/** Gruppe erstellen bzw. Einstellungen bearbeiten. */
export function GroupForm({ groupId, initial }: { groupId?: string; initial?: GroupFormValues }) {
  const router = useRouter();
  const locked = useLockedHandler();
  const [v, setV] = useState<GroupFormValues>(initial ?? { name: "", description: "", rules: "", privacy: "public", region: null, requirePostApproval: false, cover: null });
  const [pending, start] = useTransition();
  const set = <K extends keyof GroupFormValues>(k: K, val: GroupFormValues[K]) => setV((x) => ({ ...x, [k]: val }));

  const submit = () =>
    start(async () => {
      const payload = { name: v.name, description: v.description, rules: v.rules, privacy: v.privacy, region: v.region, requirePostApproval: v.requirePostApproval, coverMediaId: v.cover?.id ?? null };
      const res = groupId ? await updateGroup({ ...payload, groupId }) : await createGroup(payload);
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      toast.success(groupId ? "Gespeichert" : "Gruppe erstellt");
      router.push(`/gruppen/${res.data.slug}`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5 rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-name">Name</Label>
        <Input id="g-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="z. B. Zürich Nightlife" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Titelbild</Label>
        <MediaUploader purpose="group" value={v.cover ? [v.cover] : []} onChange={(l) => set("cover", l.at(-1) ?? null)} max={1} accept="image/*" label="Titelbild hochladen (Querformat)" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-desc">Beschreibung</Label>
        <Textarea id="g-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} rows={4} placeholder="Worum geht es in der Gruppe?" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-rules">Regeln</Label>
        <Textarea id="g-rules" value={v.rules} onChange={(e) => set("rules", e.target.value)} maxLength={4000} rows={4} placeholder={"1. Respektvoller Umgang\n2. …"} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Typ</Label>
        <RadioGroup value={v.privacy} onValueChange={(p) => set("privacy", p as GroupPrivacy)} className="grid gap-2 sm:grid-cols-3">
          {(["public", "private", "secret"] as const).map((p) => {
            const Icon = PRIVACY_ICON[p];
            return (
              <Label key={p} className="flex cursor-pointer flex-col items-start gap-1 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary">
                <span className="flex items-center gap-2 font-semibold">
                  <RadioGroupItem value={p} /> <Icon className="size-4" /> {PRIVACY_LABELS[p]}
                </span>
                <span className="text-xs text-muted-foreground">{PRIVACY_HINTS[p]}</span>
              </Label>
            );
          })}
        </RadioGroup>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Region (für Vorschläge)</Label>
          <Select options={REGIONS} value={v.region} onChange={(r) => set("region", r)} clearable searchable placeholder="Keine Region" aria-label="Region" />
        </div>
        <label className="flex items-center gap-3 self-end rounded-md border p-3 text-sm">
          <Switch checked={v.requirePostApproval} onCheckedChange={(c) => set("requirePostApproval", c)} />
          <span>
            <span className="font-semibold">Beiträge vorab freigeben</span>
            <span className="block text-xs text-muted-foreground">Beiträge von Mitgliedern erscheinen erst nach Freigabe.</span>
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Abbrechen
        </Button>
        <Button onClick={submit} disabled={pending || v.name.trim().length < 3}>
          {pending && <Loader2 className="animate-spin" />} {groupId ? "Speichern" : "Gruppe erstellen"}
        </Button>
      </div>
    </div>
  );
}
