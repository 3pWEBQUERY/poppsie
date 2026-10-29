"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAge } from "@/app/actions/site";
import { Logo } from "./logo";

/** Age-Gate vor dem Betreten (18+). */
export function AgeGate() {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="age-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <ShieldCheck className="mx-auto mb-4 size-10 text-primary" />
        <h2 id="age-title" className="mb-2 text-2xl font-bold">
          Nur für Erwachsene
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Diese Website enthält Inhalte für Erwachsene. Mit dem Betreten bestätigst du, dass du mindestens 18 Jahre alt bist und mit
          erotischen Inhalten einverstanden bist.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="flex-1"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await confirmAge();
                setOpen(false);
              })
            }
          >
            Ich bin 18 oder älter
          </Button>
          <Button size="lg" variant="outline" className="flex-1" asChild>
            <a href="https://www.google.ch">Verlassen</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
