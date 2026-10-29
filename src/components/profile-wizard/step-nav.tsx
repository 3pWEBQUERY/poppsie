"use client";

import { Check, CircleAlert, CloudCheck, Loader2 } from "lucide-react";
import type { Check as ProfileCheck } from "@/lib/profile/completeness";
import type { StepDef } from "@/lib/profiles/steps";
import { cn } from "@/lib/utils";
import type { SaveState } from "./use-profile-editor";

export function stepState(key: string, checks: ProfileCheck[]) {
  const req = checks.filter((c) => c.step === key && c.required);
  if (req.length === 0) return checks.some((c) => c.step === key && c.done) ? "done" : "optional";
  return req.every((c) => c.done) ? "done" : "open";
}

/** Schritt-Pillen (klickbar), mit Haken für erledigte Schritte. */
export function StepPills({ steps, current, checks, onSelect }: { steps: StepDef[]; current: number; checks: ProfileCheck[]; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Schritte" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
      {steps.map((s, i) => {
        const st = stepState(s.key, checks);
        return (
          <button
            key={s.key}
            type="button"
            aria-current={i === current ? "step" : undefined}
            onClick={() => onSelect(i)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-foreground",
              i === current ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {st === "done" ? (
              <Check className={cn("size-3", i === current ? "text-background" : "text-success")} />
            ) : (
              <span className="text-[10px] tabular-nums">{i + 1}</span>
            )}
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1" aria-live="polite">
      {state === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" /> Speichert …
        </>
      )}
      {state === "saved" && (
        <>
          <CloudCheck className="size-3 text-success" /> Entwurf gespeichert
        </>
      )}
      {state === "error" && (
        <>
          <CircleAlert className="size-3 text-destructive" /> Bitte Eingaben prüfen
        </>
      )}
    </span>
  );
}
