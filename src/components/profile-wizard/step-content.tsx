"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FieldErrors } from "@/lib/profiles/schemas";
import type { StepKey } from "@/lib/profiles/steps";
import type { ProfileDraft, StepValues } from "@/lib/profiles/types";
import { AppearanceStep } from "./appearance-step";
import { ClubBasicsStep, EscortBasicsStep, MemberBasicsStep } from "./basics-steps";
import { ClubDetailsStep, ClubHoursStep } from "./club-steps";
import { TextAreaField } from "./field";
import { ClubLocationStep, EscortLocationStep } from "./location-steps";
import { MediaStep } from "./media-step";
import { ServicesStep } from "./services-step";
import type { StepProps } from "./types";

function AboutStep({ value, onChange, errors, field, label, placeholder }: StepProps<Record<string, string | null>> & { field: string; label: string; placeholder: string }) {
  return (
    <TextAreaField
      label={label}
      value={value[field]}
      onChange={(v) => onChange({ ...value, [field]: v })}
      error={errors[field]}
      required
      maxLength={5000}
      minLength={50}
      rows={10}
      placeholder={placeholder}
      hint="Keine Telefonnummern oder externen Links."
    />
  );
}

/** Rendert die passende Schritt-Komponente für Kontotyp und Schritt. */
export function StepContent({
  step,
  draft,
  value,
  onChange,
  errors,
}: {
  step: StepKey;
  draft: ProfileDraft;
  value: StepValues;
  onChange: (v: StepValues) => void;
  errors: FieldErrors;
}) {
  const p = { value: value as any, onChange: onChange as any, errors, draft };
  const t = draft.accountType;
  if (step === "media") return <MediaStep {...p} />;
  if (t === "member") return step === "basics" ? <MemberBasicsStep {...p} /> : null;
  if (t === "escort") {
    switch (step) {
      case "basics":
        return <EscortBasicsStep {...p} />;
      case "appearance":
        return <AppearanceStep {...p} />;
      case "location":
        return <EscortLocationStep {...p} />;
      case "about":
        return <AboutStep {...p} field="about" label="Über mich" placeholder="Erzähl, wer du bist, was dich ausmacht und was Gäste bei dir erwartet …" />;
      case "services":
        return <ServicesStep {...p} />;
      default:
        return null;
    }
  }
  switch (step) {
    case "basics":
      return <ClubBasicsStep {...p} />;
    case "about":
      return <AboutStep {...p} field="description" label="Beschreibung" placeholder="Ambiente, Angebot, Besonderheiten deines Betriebs …" />;
    case "location":
      return <ClubLocationStep {...p} />;
    case "hours":
      return <ClubHoursStep {...p} />;
    case "details":
      return <ClubDetailsStep {...p} />;
    default:
      return null;
  }
}
