import type { FieldErrors } from "@/lib/profiles/schemas";
import type { ProfileDraft } from "@/lib/profiles/types";

/** Gemeinsame Props aller Schritt-Komponenten (Wizard und Profil-Editor). */
export type StepProps<T> = {
  value: T;
  onChange: (next: T) => void;
  errors: FieldErrors;
  draft: ProfileDraft;
};

/** Hilfsfunktion für Teil-Updates. */
export function patcher<T extends object>(value: T, onChange: (v: T) => void) {
  return <K extends keyof T>(key: K, v: T[K]) => onChange({ ...value, [key]: v });
}
