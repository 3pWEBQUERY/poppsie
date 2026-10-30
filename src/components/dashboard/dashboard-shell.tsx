"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BottomSheet, BottomSheetContent, BottomSheetDescription, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { ProfileLockProvider } from "@/components/shared/profile-lock";
import { ProfileWizard } from "@/components/profile-wizard/profile-wizard";

const LATER_KEY = "pp:wizard-later";

type Props = {
  accountType: "member" | "escort" | "club";
  complete: boolean;
  percent: number;
  nextStep: string | null;
  kycStatus: "none" | "pending" | "verified" | "rejected";
  children: React.ReactNode;
};

/**
 * Dashboard-Hülle: Banner "Profil nicht abgeschlossen – X % fertig", automatisch öffnender Profil-Wizard
 * (Bottom-Sheet, 75 % Höhe, 100 % Breite, Swipe zum Schliessen) und Kontext für gesperrte Bereiche.
 */
export function DashboardShell({ accountType, complete, percent, nextStep, kycStatus, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<string | null>(nextStep);

  const openWizard = useCallback(
    (s?: string | null) => {
      setStep(s ?? nextStep);
      setOpen(true);
    },
    [nextStep],
  );

  // Automatisch öffnen, ausser "Später erledigen" wurde in dieser Sitzung gewählt (sessionStorage gibt es nur im Browser).
  useEffect(() => {
    if (complete) return;
    let later = false;
    try {
      later = sessionStorage.getItem(LATER_KEY) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Browser-Speicher ist erst nach dem Mount lesbar
    if (!later) setOpen(true);
  }, [complete]);

  useEffect(() => {
    const onOpen = (e: Event) => openWizard((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener("pp:open-wizard", onOpen);
    return () => window.removeEventListener("pp:open-wizard", onOpen);
  }, [openWizard]);

  const later = () => {
    try {
      sessionStorage.setItem(LATER_KEY, "1");
    } catch {}
    setOpen(false);
  };

  return (
    <ProfileLockProvider value={{ complete, percent, openWizard, loggedIn: true }}>
      {!complete && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertCircle className="size-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Profil nicht abgeschlossen – {percent} % fertig</p>
            <Progress value={percent} className="mt-2 max-w-xs" />
          </div>
          <Button size="sm" onClick={() => openWizard()}>
            Jetzt fertigstellen
          </Button>
        </div>
      )}
      {complete && accountType !== "member" && kycStatus !== "verified" && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
          <BadgeCheck className="size-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm">
            {kycStatus === "rejected"
              ? "Deine Verifikation wurde abgelehnt. Bitte versuche es erneut, damit dein Profil öffentlich sichtbar wird."
              : "Dein Profil ist fertig. Öffentlich sichtbar wird es, sobald deine Identität und dein Alter verifiziert sind."}
          </p>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/dashboard/verifikation">Zur Verifikation</Link>
          </Button>
        </div>
      )}
      {children}
      <BottomSheet open={open} onOpenChange={(o) => (o ? setOpen(true) : later())}>
        <BottomSheetContent size="tall">
          <BottomSheetHeader className="sr-only">
            <BottomSheetTitle>Profil vervollständigen</BottomSheetTitle>
            <BottomSheetDescription>Schritt für Schritt zum fertigen Profil</BottomSheetDescription>
          </BottomSheetHeader>
          {open && (
            <ProfileWizard
              accountType={accountType}
              initialStep={step}
              onLater={later}
              onSaved={() => router.refresh()}
              onFinished={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          )}
        </BottomSheetContent>
      </BottomSheet>
    </ProfileLockProvider>
  );
}
