"use client";

import { BadgeCheck, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/shared/select/select";
import { GENDERS, labelOf, CLUB_TYPES } from "@/lib/profile/fields";
import type { EscortBasics, MemberBasics } from "@/lib/profiles/schemas";
import { Field, TextAreaField, TextField } from "./field";
import { CANTON_OPTIONS, countrySelectOptions, toOptions } from "./options";
import { patcher, type StepProps } from "./types";

function CountryField({ value, onChange, error, label = "Land" }: { value: string | null | undefined; onChange: (v: string | null) => void; error?: string; label?: string }) {
  return (
    <Field label={label} error={error} required>
      <Select
        options={countrySelectOptions()}
        value={value}
        onChange={onChange}
        searchable
        searchPlaceholder="Land suchen"
        placeholder="Land wählen"
        sheetTitle={label}
        aria-label={label}
        invalid={Boolean(error)}
      />
    </Field>
  );
}

export function MemberBasicsStep({ value, onChange, errors }: StepProps<MemberBasics>) {
  const set = patcher(value, onChange);
  const ch = value.country === "CH";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CountryField value={value.country} onChange={(c) => onChange({ ...value, country: c, region: c === value.country ? value.region : null })} error={errors.country} />
      {ch ? (
        <Field label="Kanton" error={errors.region} required>
          <Select
            options={CANTON_OPTIONS}
            value={value.region}
            onChange={(v) => set("region", v)}
            searchable
            placeholder="Kanton wählen"
            sheetTitle="Kanton"
            aria-label="Kanton"
            invalid={Boolean(errors.region)}
          />
        </Field>
      ) : (
        <TextField label="Region" value={value.region} onChange={(v) => set("region", v)} error={errors.region} maxLength={60} required placeholder="z. B. Bayern" />
      )}
      <div className="sm:col-span-2">
        <TextAreaField
          label="Über mich"
          value={value.bio}
          onChange={(v) => set("bio", v)}
          error={errors.bio}
          maxLength={2000}
          rows={5}
          hint="Optional. Wird auf deinem Profil angezeigt."
          placeholder="Ein paar Worte über dich …"
        />
      </div>
    </div>
  );
}

/** Spätestes erlaubtes Geburtsdatum (18 Jahre). */
function maxBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function EscortBasicsStep({ value, onChange, errors, draft }: StepProps<EscortBasics>) {
  const set = patcher(value, onChange);
  const locked = draft.kycStatus === "verified" && Boolean(draft.values.basics?.birthDate);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Anzeigename" value={value.displayName} onChange={(v) => set("displayName", v)} error={errors.displayName} maxLength={40} required placeholder="z. B. Sophia" />
      <Field label="Geschlecht" error={errors.gender} required>
        <Select options={toOptions(GENDERS)} value={value.gender} onChange={(v) => set("gender", v)} placeholder="Bitte wählen" aria-label="Geschlecht" invalid={Boolean(errors.gender)} />
      </Field>
      <Field
        label="Geburtsdatum"
        error={errors.birthDate}
        required
        hint={
          locked ? (
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className="size-3 text-primary" /> Aus der Verifikation übernommen – nicht änderbar.
            </span>
          ) : (
            "Öffentlich wird nur dein Alter angezeigt. Nach der Verifikation nicht mehr änderbar."
          )
        }
      >
        <div className="relative">
          <Input
            type="date"
            value={value.birthDate ?? ""}
            max={maxBirthDate()}
            readOnly={locked}
            disabled={locked}
            aria-invalid={Boolean(errors.birthDate)}
            onChange={(e) => set("birthDate", e.target.value || null)}
           
          />
          {locked && <Lock className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />}
        </div>
      </Field>
      <CountryField value={value.country} onChange={(v) => set("country", v)} error={errors.country} label="Land, in dem du arbeitest" />
      <TextField
        label="Slogan"
        value={value.slogan}
        onChange={(v) => set("slogan", v)}
        error={errors.slogan}
        maxLength={120}
        placeholder="z. B. Herzlich, diskret und mit viel Zeit für dich"
        className="sm:col-span-2"
      />
    </div>
  );
}

export function ClubBasicsStep({ value, onChange, errors, draft }: StepProps<{ name?: string | null; country?: string | null }>) {
  const set = patcher(value, onChange);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Name des Betriebs" value={value.name} onChange={(v) => set("name", v)} error={errors.name} maxLength={80} required className="sm:col-span-2" />
      <Field label="Betriebstyp" hint="Bei der Registrierung gewählt. Für eine Änderung wende dich an den Support.">
        <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted px-3 text-sm">
          <Lock className="size-3.5 text-muted-foreground" />
          {draft.clubTypeLabel ?? labelOf(CLUB_TYPES, draft.clubType)}
        </div>
      </Field>
      <CountryField value={value.country} onChange={(v) => set("country", v)} error={errors.country} />
    </div>
  );
}
