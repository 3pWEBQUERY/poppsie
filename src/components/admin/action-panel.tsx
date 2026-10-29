"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, Eye, EyeOff, Hand, Loader2, LockOpen, Trash2, Undo2, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { claimFlag, dismiss, moderate, reopenFlag } from "@/lib/admin/actions/moderation";
import type { FlagTarget } from "@/lib/admin/labels";
import { ReasonDialog } from "./reason-dialog";

type Props = {
  flag?: { id: string; status: "open" | "in_review" | "resolved" | "dismissed"; targetType: FlagTarget; contentRemovable: boolean; urgent: boolean };
  user: { id: string; status: "pending" | "active" | "suspended" | "deleted"; profileHidden: boolean } | null;
};

const DAYS = [1, 3, 7, 14, 30, 90];

/** Moderationsaktionen für eine Meldung oder direkt für ein Konto. Jede Aktion verlangt eine Begründung. */
export function ActionPanel({ flag, user }: Props) {
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [threadMode, setThreadMode] = useState<"lock" | "delete">("lock");
  const [restore, setRestore] = useState(Boolean(flag?.urgent));
  const [pending, start] = useTransition();
  const closed = flag && (flag.status === "resolved" || flag.status === "dismissed");

  const done = (msg: string) => (res: { ok: true } | { ok: false; error: string }) => {
    if (res.ok) {
      toast.success(msg);
      router.refresh();
    }
    return res;
  };
  const act = (action: Parameters<typeof moderate>[0]["action"], msg: string, extra: Partial<Parameters<typeof moderate>[0]> = {}) => (reason: string) =>
    moderate({ action, reason, flagId: flag?.id, userId: flag ? undefined : user?.id, ...extra }).then(done(msg));

  if (!user && !flag) return null;

  return (
    <div className="flex flex-col gap-3">
      {flag && closed && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-secondary/40 px-3 py-2 text-xs">
          Diese Meldung ist abgeschlossen.
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void done("Meldung wieder geöffnet")(await reopenFlag(flag.id)))}>
            <Undo2 /> Wieder öffnen
          </Button>
        </div>
      )}
      {flag?.status === "open" && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await claimFlag(flag.id);
              if (!res.ok) toast.error(res.error);
              else done("Meldung übernommen")(res);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Hand />} In Prüfung nehmen
        </Button>
      )}
      {!user && <p className="text-xs text-muted-foreground">Die betroffene Person konnte nicht ermittelt werden (Inhalt gelöscht).</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 [&>button]:h-8 [&>button]:justify-start [&>button]:px-2.5 [&>button]:text-xs">
        {user && (
          <ReasonDialog
            trigger={
              <Button variant="outline">
                <AlertTriangle /> Verwarnen
              </Button>
            }
            title="Verwarnung aussprechen"
            description="Die Person erhält eine Mitteilung und eine E-Mail mit deiner Begründung."
            confirmLabel="Verwarnen"
            onSubmit={act("warn", "Verwarnung gesendet")}
          />
        )}
        {flag && flag.contentRemovable && user && (
          <ReasonDialog
            trigger={
              <Button variant="outline">
                <Trash2 /> Inhalt entfernen
              </Button>
            }
            title="Inhalt entfernen"
            description={
              flag.targetType === "story" || flag.targetType === "group"
                ? "Achtung: Stories und Gruppen werden endgültig gelöscht und können bei einem Einspruch nicht wiederhergestellt werden."
                : "Beiträge, Kommentare und Nachrichten werden ausgeblendet (soft delete), Berichte versteckt, Medien abgelehnt."
            }
            confirmLabel="Entfernen"
            destructive
            onSubmit={act("remove_content", "Inhalt entfernt", flag.targetType === "thread" ? { threadMode } : {})}
          >
            {flag.targetType === "thread" && (
              <RadioGroup value={threadMode} onValueChange={(v) => setThreadMode(v as "lock" | "delete")} className="flex flex-col gap-2">
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="lock" /> Thread schliessen (umkehrbar)
                </Label>
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="delete" /> Thread mit allen Antworten löschen
                </Label>
              </RadioGroup>
            )}
          </ReasonDialog>
        )}
        {user && user.status !== "suspended" && (
          <>
            <ReasonDialog
              trigger={
                <Button variant="outline">
                  <Ban /> Temporär sperren
                </Button>
              }
              title="Konto temporär sperren"
              description="Alle Sitzungen werden beendet. Die Anmeldung ist bis zum Ablauf gesperrt."
              confirmLabel={`${days} Tage sperren`}
              destructive
              onSubmit={act("suspend_temp", "Konto gesperrt", { days })}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="days">Dauer in Tagen</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => (
                    <Button key={d} type="button" size="sm" variant={days === d ? "default" : "secondary"} onClick={() => setDays(d)}>
                      {d}
                    </Button>
                  ))}
                  <Input id="days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} className="h-8 w-20" />
                </div>
              </div>
            </ReasonDialog>
            <ReasonDialog
              trigger={
                <Button variant="outline" className="text-destructive">
                  <XCircle /> Permanent sperren
                </Button>
              }
              title="Konto permanent sperren"
              description="Die Person kann sich nicht mehr anmelden, bis die Sperre aufgehoben wird. Alle Sitzungen werden beendet."
              confirmLabel="Permanent sperren"
              destructive
              onSubmit={act("suspend_perm", "Konto permanent gesperrt")}
            />
          </>
        )}
        {user && user.status === "suspended" && (
          <ReasonDialog
            trigger={
              <Button variant="outline">
                <LockOpen /> Entsperren
              </Button>
            }
            title="Sperre aufheben"
            confirmLabel="Entsperren"
            onSubmit={act("unsuspend", "Sperre aufgehoben")}
          />
        )}
        {user &&
          (user.profileHidden ? (
            <ReasonDialog
              trigger={
                <Button variant="outline">
                  <Eye /> Profil wiederherstellen
                </Button>
              }
              title="Profil wieder einblenden"
              confirmLabel="Wiederherstellen"
              onSubmit={act("restore_profile", "Profil wieder sichtbar")}
            />
          ) : (
            <ReasonDialog
              trigger={
                <Button variant="outline">
                  <EyeOff /> Profil ausblenden
                </Button>
              }
              title="Profil ausblenden"
              description="Das Profil verschwindet aus Suche, Feed und Direktlinks, das Konto bleibt aktiv."
              confirmLabel="Ausblenden"
              destructive
              onSubmit={act("hide_profile", "Profil ausgeblendet")}
            />
          ))}
      </div>
      {flag && !closed && (
        <ReasonDialog
          trigger={
            <Button variant="ghost" className="justify-start text-muted-foreground">
              <UserCheck /> Meldung verwerfen (kein Verstoss)
            </Button>
          }
          title="Meldung verwerfen"
          description="Die meldende Person erhält deine Begründung als Mitteilung."
          reasonLabel="Begründung (an die meldende Person)"
          confirmLabel="Verwerfen"
          onSubmit={(reason) => dismiss({ flagId: flag.id, reason, restoreProfile: restore }).then(done("Meldung verworfen"))}
        >
          {user?.profileHidden && (
            <Label className="flex items-start gap-2 text-sm font-normal">
              <Checkbox checked={restore} onCheckedChange={(v) => setRestore(v === true)} className="mt-0.5" />
              Vorläufig ausgeblendetes Profil wieder einblenden (nur wenn keine weitere dringende Meldung offen ist)
            </Label>
          )}
        </ReasonDialog>
      )}
    </div>
  );
}
