"use client";

import { useState, useTransition } from "react";
import { Flag as FlagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { createFlag } from "@/app/actions/moderation";

type Target = "profile" | "post" | "comment" | "review" | "message" | "story" | "group" | "thread" | "media";

const REASONS = [
  { value: "minor", label: "Verdacht auf Minderjährigkeit", urgent: true },
  { value: "coercion", label: "Verdacht auf Zwang", urgent: true },
  { value: "trafficking", label: "Verdacht auf Menschenhandel", urgent: true },
  { value: "fake", label: "Fake / erfundene Angaben" },
  { value: "abuse", label: "Beleidigend oder belästigend" },
  { value: "privacy", label: "Verletzt meine Privatsphäre" },
  { value: "spam", label: "Spam oder Werbung" },
  { value: "illegal", label: "Illegaler Inhalt" },
  { value: "other", label: "Anderer Grund" },
] as const;

export function ReportDialog({
  targetType,
  targetId,
  targetUserId,
  trigger,
}: {
  targetType: Target;
  targetId: string;
  targetUserId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("fake");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await createFlag({ targetType, targetId, targetUserId, reason, details: details || undefined });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.urgent ? "Danke. Die Meldung wird sofort mit höchster Priorität geprüft." : "Danke für deine Meldung. Wir prüfen sie.");
      setOpen(false);
      setDetails("");
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <FlagIcon /> Melden
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inhalt melden</DialogTitle>
          <DialogDescription>Meldungen sind anonym. Bei akuter Gefahr wende dich bitte direkt an die Polizei (117).</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as typeof reason)} className="gap-2">
          {REASONS.map((r) => (
            <Label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 font-normal has-[[data-state=checked]]:border-primary">
              <RadioGroupItem value={r.value} />
              <span className="flex-1">{r.label}</span>
              {"urgent" in r && <span className="text-xs font-semibold text-primary">Priorität</span>}
            </Label>
          ))}
        </RadioGroup>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Weitere Hinweise (optional)" maxLength={2000} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            Meldung senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
