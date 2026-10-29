"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Fehlerseite für den Site-Bereich (Header und Footer bleiben sichtbar). */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-4 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/15">
        <TriangleAlert className="size-7 text-primary" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">Da ist etwas schiefgelaufen</h1>
        <p className="text-sm text-muted-foreground">Die Seite konnte nicht geladen werden. Versuche es noch einmal – oft hilft das schon.</p>
        {digest && <p className="font-mono text-[11px] text-muted-foreground">Fehler-ID: {digest}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw /> Erneut versuchen
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">Zur Startseite</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Bleibt der Fehler bestehen? Schreib an <a href="mailto:support@poppsie.ch" className="underline">support@poppsie.ch</a>.
      </p>
    </div>
  );
}
