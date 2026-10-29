"use client";

import { MapPin, ShieldCheck } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/shared/select/select";
import type { ClubLocation, EscortLocation } from "@/lib/profiles/schemas";
import { Field, TextField } from "./field";
import { citySelectOptions } from "./options";
import { patcher, type StepProps } from "./types";

function CityField({ value, onChange, error }: { value: string | null | undefined; onChange: (v: string | null) => void; error?: string }) {
  return (
    <Field label="Stadt" error={error} required>
      <Select
        options={citySelectOptions()}
        value={value}
        onChange={onChange}
        searchable
        searchPlaceholder="Stadt suchen"
        placeholder="Stadt wählen"
        sheetTitle="Stadt"
        aria-label="Stadt"
        invalid={Boolean(error)}
      />
    </Field>
  );
}

export function EscortLocationStep({ value, onChange, errors }: StepProps<EscortLocation>) {
  const set = patcher(value, onChange);
  const radius = value.radiusKm ?? 10;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <p>Wir zeigen nur deine Stadt und den Umkreis, in dem du unterwegs bist. Deine genaue Adresse wird nie gespeichert oder angezeigt.</p>
      </div>
      <CityField value={value.city} onChange={(v) => set("city", v)} error={errors.city} />
      <Field label="Umkreis" error={errors.radiusKm} hint="Für Outcall: wie weit du fährst. Für Incall: grober Bereich deines Standorts.">
        <div className="flex items-center gap-4">
          <Slider value={[radius]} min={0} max={100} step={5} onValueChange={([v]) => set("radiusKm", v ?? 0)} aria-label="Umkreis in Kilometern" />
          <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">{radius} km</span>
        </div>
      </Field>
    </div>
  );
}

export function ClubLocationStep({ value, onChange, errors }: StepProps<ClubLocation>) {
  const set = patcher(value, onChange);
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
      <TextField label="Strasse und Nr." value={value.street} onChange={(v) => set("street", v)} error={errors.street} maxLength={120} required placeholder="Musterstrasse 12" />
      <TextField label="PLZ" value={value.postalCode} onChange={(v) => set("postalCode", v)} error={errors.postalCode} maxLength={5} placeholder="8000" />
      <div className="sm:col-span-2">
        <CityField value={value.city} onChange={(v) => set("city", v)} error={errors.city} />
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
        <MapPin className="size-3.5" /> Die Adresse erscheint auf deinem Profil zusammen mit einer Karte.
      </p>
    </div>
  );
}
