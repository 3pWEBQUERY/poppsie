"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfileLock } from "@/components/shared/profile-lock";

/** Wird statt einer gesperrten Seite gerendert (Direktaufruf per URL bei unvollständigem Profil). */
export function LockedNotice({ title }: { title: string }) {
  const { openWizard, percent } = useProfileLock();
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
      <Lock className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Bitte stelle zuerst dein Profil fertig ({percent} % erledigt). Danach sind alle Bereiche frei.</p>
      <Button onClick={() => openWizard()}>Profil fertigstellen</Button>
    </div>
  );
}
