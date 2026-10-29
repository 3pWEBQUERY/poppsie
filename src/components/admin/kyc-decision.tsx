"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideKyc } from "@/lib/admin/actions/manage";

/** Entscheid über alle offenen Nachweise einer Person. Ablehnen verlangt eine Begründung. */
export function KycDecision({ userId, canApprove, blockReason }: { userId: string; canApprove: boolean; blockReason?: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const submit = (decision: "verified" | "rejected") =>
    start(async () => {
      const res = await decideKyc({ userId, decision, note });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(decision === "verified" ? "Verifikation bestätigt" : "Verifikation abgelehnt");
        router.refresh();
      }
    });
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`note-${userId}`} className="text-xs">
        Notiz an die Person (bei Ablehnung Pflicht)
      </Label>
      <Textarea id={`note-${userId}`} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Geste auf dem Selfie nicht erkennbar" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || !canApprove} onClick={() => submit("verified")}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Bestätigen
        </Button>
        <Button size="sm" variant="secondary" disabled={pending || note.trim().length < 5} onClick={() => submit("rejected")}>
          <X /> Ablehnen
        </Button>
        {!canApprove && blockReason && <span className="text-xs text-primary">{blockReason}</span>}
      </div>
    </div>
  );
}
