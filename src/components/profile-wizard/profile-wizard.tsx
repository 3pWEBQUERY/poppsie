"use client";

import { Button } from "@/components/ui/button";

/** Platzhalter – wird vom Profil-Modul implementiert (Schritte je Kontotyp, Autosave). */
export function ProfileWizard({
  onLater,
}: {
  accountType: "member" | "escort" | "club";
  initialStep: string | null;
  onLater: () => void;
  onSaved: () => void;
  onFinished: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-muted-foreground">Profil-Wizard</p>
      <Button variant="outline" onClick={onLater}>
        Später erledigen
      </Button>
    </div>
  );
}
