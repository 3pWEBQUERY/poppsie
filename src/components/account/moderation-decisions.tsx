"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitAppeal } from "@/lib/account/actions";
import { ACTION_LABEL, APPEALABLE, APPEAL_STATUS_LABEL, type ModerationActionType } from "@/lib/admin/labels";

/** Datumsangaben kommen serverseitig formatiert an (Zeitzone der Person). */
export type Decision = {
  id: string;
  action: ModerationActionType;
  reason: string;
  until: string | null;
  createdAt: string;
  appeal: { status: "open" | "accepted" | "rejected"; createdAt: string } | null;
  /** Einspruchsfrist (90 Tage) abgelaufen – serverseitig berechnet. */
  expired: boolean;
};


function AppealForm({ actionId, onDone }: { actionId: string; onDone: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitAppeal({ actionId, body });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Einspruch eingereicht. Wir melden uns.");
            onDone();
            router.refresh();
          }
        });
      }}
    >
      <Label htmlFor={`appeal-${actionId}`}>Deine Begründung</Label>
      <Textarea
        id={`appeal-${actionId}`}
        rows={4}
        minLength={20}
        maxLength={3000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Erkläre, warum der Entscheid aus deiner Sicht falsch ist. Eine andere Person aus dem Team prüft ihn erneut."
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || body.trim().length < 20}>
          {pending && <Loader2 className="animate-spin" />} Einspruch senden
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">{body.trim().length} / mind. 20 Zeichen</span>
      </div>
    </form>
  );
}

export function ModerationDecisions({ decisions }: { decisions: Decision[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!decisions.length) return <p className="text-sm text-muted-foreground">Es gibt keine Moderationsentscheide zu deinem Konto.</p>;
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {decisions.map((d) => {
        const expired = d.expired;
        const canAppeal = APPEALABLE.has(d.action) && !d.appeal && !expired;
        return (
          <li key={d.id} className="flex flex-col gap-1 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={d.action.startsWith("suspend") || d.action === "remove_content" ? "default" : "secondary"}>{ACTION_LABEL[d.action]}</Badge>
              {d.until && <span className="text-xs text-muted-foreground">bis {d.until}</span>}
              {d.appeal && (
                <Badge variant={d.appeal.status === "accepted" ? "success" : d.appeal.status === "open" ? "warning" : "muted"}>
                  Einspruch {APPEAL_STATUS_LABEL[d.appeal.status].toLowerCase()}
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{d.createdAt}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{d.reason}</p>
            {canAppeal &&
              (open === d.id ? (
                <AppealForm actionId={d.id} onDone={() => setOpen(null)} />
              ) : (
                <div>
                  <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setOpen(d.id)}>
                    <Scale /> Einspruch erheben
                  </Button>
                </div>
              ))}
            {APPEALABLE.has(d.action) && !d.appeal && expired && <p className="text-[11px] text-muted-foreground">Einspruchsfrist (90 Tage) abgelaufen.</p>}
          </li>
        );
      })}
    </ul>
  );
}
