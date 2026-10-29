"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { stepsFor, type StepKey } from "@/lib/profiles/steps";
import type { ProfileDraft } from "@/lib/profiles/types";
import { SaveIndicator, stepState } from "./step-nav";
import { StepContent } from "./step-content";
import { useProfileEditor } from "./use-profile-editor";

/** Vollseiten-Editor (/dashboard/profil): ein Tab pro Wizard-Schritt, gleiche Komponenten und Autosave. */
export function ProfileEditor({ initial, initialTab, publicHref }: { initial: ProfileDraft; initialTab?: string | null; publicHref: string }) {
  const router = useRouter();
  const steps = stepsFor(initial.accountType);
  const [tab, setTab] = useState<StepKey>(() => (steps.find((s) => s.key === initialTab)?.key ?? steps[0]!.key) as StepKey);
  const [busy, setBusy] = useState(false);
  const editor = useProfileEditor(initial, { onSaved: () => router.refresh() });
  const { draft, values, errors, status } = editor;

  const switchTab = async (next: string) => {
    void editor.persist(tab, false);
    setTab(next as StepKey);
  };

  const save = async () => {
    setBusy(true);
    const ok = await editor.persist(tab, true);
    setBusy(false);
    if (ok) toast.success("Gespeichert");
  };

  const current = steps.find((s) => s.key === tab)!;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Profil bearbeiten</h1>
          <p className="mt-1 text-sm text-muted-foreground">Änderungen werden automatisch als Entwurf gespeichert.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={publicHref} target="_blank">
            <ExternalLink /> Öffentliches Profil
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex-1">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-muted-foreground">Profil {status?.complete ? "vollständig" : "unvollständig"}</span>
            <span className="font-semibold tabular-nums">{status?.percent ?? 0} %</span>
          </div>
          <Progress value={status?.percent ?? 0} aria-label="Profil-Fortschritt" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => void switchTab(v)}>
        <TabsList className="flex-nowrap overflow-x-auto [scrollbar-width:none]">
          {steps.map((s) => {
            const st = stepState(s.key, status?.checks ?? []);
            return (
              <TabsTrigger key={s.key} value={s.key} className="h-7 px-3 text-xs">
                {s.label}
                {st === "open" && <span aria-label="Pflichtangaben fehlen" className="size-1.5 rounded-full bg-warning" />}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {steps.map((s) => (
          <TabsContent key={s.key} value={s.key} className="rounded-lg border bg-card p-4 sm:p-5">
            {s.key === tab && draft && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-base font-bold">{current.label}</h2>
                  <p className="text-xs text-muted-foreground">{current.description}</p>
                </div>
                <StepContent step={s.key} draft={draft} value={values[s.key] ?? {}} onChange={(v) => editor.update(s.key, v)} errors={errors[s.key] ?? {}} />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t bg-background px-1 py-3">
        <span className="mr-auto text-xs text-muted-foreground">
          <SaveIndicator state={editor.saveState} />
        </span>
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Speichern
        </Button>
      </div>
    </div>
  );
}
