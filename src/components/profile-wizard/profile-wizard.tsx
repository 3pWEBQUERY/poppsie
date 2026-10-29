"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { stepsFor, type StepKey } from "@/lib/profiles/steps";
import { cn } from "@/lib/utils";
import { SaveIndicator, StepPills } from "./step-nav";
import { StepContent } from "./step-content";
import { useProfileEditor } from "./use-profile-editor";

/**
 * Profil-Wizard im Bottom-Sheet (75 % Höhe): Schritte je Kontotyp, Fortschrittsbalken,
 * Autosave pro Schritt, Zurück / Weiter / Später erledigen / Fertigstellen.
 */
export function ProfileWizard({
  accountType,
  initialStep,
  onLater,
  onSaved,
  onFinished,
}: {
  accountType: "member" | "escort" | "club";
  initialStep: string | null;
  onLater: () => void;
  onSaved: () => void;
  onFinished: () => void;
}) {
  const steps = stepsFor(accountType);
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex((s) => s.key === initialStep)));
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const editor = useProfileEditor(null, { onSaved: () => onSaved() });
  const { draft, values, errors, status } = editor;
  const step = steps[index]!;
  const last = index === steps.length - 1;

  const go = async (to: number, validate: boolean) => {
    setBusy(true);
    const ok = await editor.persist(step.key, validate);
    setBusy(false);
    if (!ok && validate) return;
    setMissing(false);
    setIndex(Math.min(Math.max(0, to), steps.length - 1));
  };

  const finish = async () => {
    setBusy(true);
    const ok = await editor.persist(step.key, true);
    await editor.flush();
    setBusy(false);
    if (!ok) return;
    if (editor.currentStatus()?.complete) {
      toast.success("Dein Profil ist fertig!");
      onFinished();
    } else {
      setMissing(true);
    }
  };

  const later = async () => {
    setBusy(true);
    await editor.flush();
    setBusy(false);
    onLater();
  };

  const openChecks = status?.checks.filter((c) => c.required && !c.done) ?? [];
  const jump = (key: string) => {
    const i = steps.findIndex((s) => s.key === key);
    if (i >= 0) void go(i, false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 pb-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-base font-bold">Profil vervollständigen</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <SaveIndicator state={editor.saveState} />
              <span className="font-semibold text-foreground tabular-nums">{status?.percent ?? 0} %</span>
            </div>
          </div>
          <Progress value={status?.percent ?? 0} aria-label="Profil-Fortschritt" />
          <StepPills steps={steps} current={index} checks={status?.checks ?? []} onSelect={(i) => void go(i, false)} />
        </div>
      </header>

      <div data-vaul-no-drag className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Schritt {index + 1} von {steps.length}
            </p>
            <h2 className="text-lg font-bold">{step.label}</h2>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
          {missing && openChecks.length > 0 && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="size-4 text-warning" /> Es fehlen noch Pflichtangaben
              </p>
              <div className="flex flex-wrap gap-1.5">
                {openChecks.map((c) => (
                  <button key={c.key} type="button" onClick={() => jump(c.step)} className="rounded-full border border-warning/40 px-2.5 py-0.5 text-xs hover:bg-warning/20">
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {editor.loadError ? (
            <p className="text-sm text-destructive">{editor.loadError}</p>
          ) : !draft ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <StepContent
              key={step.key}
              step={step.key as StepKey}
              draft={draft}
              value={values[step.key] ?? {}}
              onChange={(v) => editor.update(step.key, v)}
              errors={errors[step.key] ?? {}}
            />
          )}
        </div>
      </div>

      <footer className="border-t px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void go(index - 1, false)} disabled={index === 0 || busy}>
            <ArrowLeft /> Zurück
          </Button>
          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => void later()} disabled={busy}>
            Später erledigen
          </Button>
          <Button type="button" size="sm" onClick={() => void (last ? finish() : go(index + 1, true))} disabled={busy || !draft} className={cn("min-w-28")}>
            {busy ? <Loader2 className="animate-spin" /> : last ? <Check /> : null}
            {last ? "Fertigstellen" : "Weiter"}
            {!last && !busy && <ArrowRight />}
          </Button>
        </div>
      </footer>
    </div>
  );
}
