"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useState } from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Ctx = { complete: boolean; percent: number; openWizard: (step?: string | null) => void; loggedIn: boolean };
const LockContext = createContext<Ctx>({ complete: true, percent: 100, openWizard: () => {}, loggedIn: false });

export function ProfileLockProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export const useProfileLock = () => useContext(LockContext);

/**
 * Reagiert auf Fehler aus Server Actions: PROFILE_INCOMPLETE öffnet den Profil-Wizard-Hinweis,
 * UNAUTHENTICATED leitet zum Login. Gibt true zurück, wenn der Fehler behandelt wurde.
 */
export function useLockedHandler() {
  const { openWizard } = useProfileLock();
  const router = useRouter();
  return useCallback(
    (res: { ok: boolean; code?: string; error?: string }) => {
      if (res.ok) return false;
      if (res.code === "PROFILE_INCOMPLETE") {
        toast("Bitte stelle zuerst dein Profil fertig", { action: { label: "Jetzt fertigstellen", onClick: () => openWizard() } });
        return true;
      }
      if (res.code === "UNAUTHENTICATED") {
        router.push(`/anmelden?next=${encodeURIComponent(window.location.pathname)}`);
        return true;
      }
      return false;
    },
    [openWizard, router],
  );
}

/**
 * Gesperrter Dashboard-Bereich: sichtbar, aber ausgegraut mit Schloss. Klick öffnet ein kleines Popover
 * mit Button, der den Profil-Wizard an der offenen Stelle öffnet.
 */
export function LockedLink({ href, locked, className, children }: { href: string; locked: boolean; className?: string; children: React.ReactNode }) {
  const { openWizard } = useProfileLock();
  const [open, setOpen] = useState(false);
  if (!locked) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-disabled="true" className={cn(className, "relative cursor-pointer opacity-45")}>
          {children}
          <Lock className="ml-auto size-3.5 shrink-0" aria-label="Gesperrt" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64">
        <p className="mb-3 text-sm font-medium">Bitte stelle zuerst dein Profil fertig</p>
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            setOpen(false);
            openWizard();
          }}
        >
          Profil fertigstellen
        </Button>
      </PopoverContent>
    </Popover>
  );
}
