"use client";

import { MultiSelect, MultiSelectWithLevel, Select } from "@/components/shared/select/select";
import {
  BREAST_TYPES,
  CLOTHING_SIZES,
  CLOTHING_STYLES,
  CUP_SIZES,
  EYE_COLORS,
  HAIR_COLORS,
  INTIMATE,
  PIERCINGS,
  SHOE_SIZES,
  TATTOOS,
} from "@/lib/profile/fields";
import type { EscortAppearance } from "@/lib/profiles/schemas";
import { Field, NumberField, Section } from "./field";
import { countrySelectOptions, languageSelectOptions, toOptions } from "./options";
import { patcher, type StepProps } from "./types";

type SingleKey = "cupSize" | "breastType" | "intimate" | "tattoos" | "clothingSize" | "shoeSize" | "hairColor" | "eyeColor";

const SINGLES: { key: SingleKey; label: string; options: { value: string; label: string }[] }[] = [
  { key: "hairColor", label: "Haarfarbe", options: HAIR_COLORS },
  { key: "eyeColor", label: "Augenfarbe", options: EYE_COLORS },
  { key: "cupSize", label: "Körbchengrösse", options: CUP_SIZES },
  { key: "breastType", label: "Brust", options: BREAST_TYPES },
  { key: "intimate", label: "Intimbereich", options: INTIMATE },
  { key: "tattoos", label: "Tätowierungen", options: TATTOOS },
  { key: "clothingSize", label: "Kleidergrösse", options: CLOTHING_SIZES },
  { key: "shoeSize", label: "Schuhgrösse", options: SHOE_SIZES },
];

export function AppearanceStep({ value, onChange, errors }: StepProps<EscortAppearance>) {
  const set = patcher(value, onChange);
  return (
    <div className="flex flex-col gap-6">
      <Section title="Herkunft & Sprachen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nationalität" error={errors.nationality}>
            <Select
              options={countrySelectOptions()}
              value={value.nationality}
              onChange={(v) => set("nationality", v)}
              searchable
              clearable
              searchPlaceholder="Land suchen"
              placeholder="Nationalität wählen"
              sheetTitle="Nationalität"
              aria-label="Nationalität"
            />
          </Field>
          <Field label="Sprachen" error={errors.languages} required hint="Niveau mit 1–5 Sternen angeben.">
            <MultiSelectWithLevel
              options={languageSelectOptions()}
              value={value.languages ?? []}
              onChange={(v) => set("languages", v)}
              searchable
              searchPlaceholder="Sprache suchen"
              placeholder="Sprachen wählen"
              sheetTitle="Sprachen"
              aria-label="Sprachen"
              levelLabel="Niveau"
              invalid={Boolean(errors.languages)}
            />
          </Field>
        </div>
      </Section>
      <Section title="Körper">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberField label="Grösse" value={value.heightCm} onChange={(v) => set("heightCm", v)} error={errors.heightCm} min={140} max={210} suffix="cm" />
          <NumberField label="Gewicht" value={value.weightKg} onChange={(v) => set("weightKg", v)} error={errors.weightKg} min={40} max={150} suffix="kg" />
          {SINGLES.map((s) => (
            <Field key={s.key} label={s.label} error={errors[s.key]}>
              <Select
                options={toOptions(s.options)}
                value={value[s.key] ?? null}
                onChange={(v) => set(s.key, v)}
                clearable
                placeholder="–"
                sheetTitle={s.label}
                aria-label={s.label}
              />
            </Field>
          ))}
        </div>
      </Section>
      <Section title="Stil">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Piercings" error={errors.piercings}>
            <MultiSelect
              options={toOptions(PIERCINGS)}
              value={value.piercings ?? []}
              onChange={(v) => set("piercings", v.includes("keine") && !(value.piercings ?? []).includes("keine") ? ["keine"] : v.filter((x) => x !== "keine" || v.length === 1))}
              placeholder="Keine Angabe"
              sheetTitle="Piercings"
              aria-label="Piercings"
            />
          </Field>
          <Field label="Kleidungsstil" error={errors.clothingStyles}>
            <MultiSelect
              options={toOptions(CLOTHING_STYLES)}
              value={value.clothingStyles ?? []}
              onChange={(v) => set("clothingStyles", v)}
              placeholder="Keine Angabe"
              sheetTitle="Kleidungsstil"
              aria-label="Kleidungsstil"
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
