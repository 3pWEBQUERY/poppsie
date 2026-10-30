"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { decideAppeal } from "@/lib/admin/actions/moderation";
import { ReasonDialog } from "./reason-dialog";

export function AppealDecision({ appealId, revertHint }: { appealId: string; revertHint: string }) {
  const router = useRouter();
  const [revert, setRevert] = useState(true);
  const submit = (decision: "accepted" | "rejected") => async (note: string) => {
    const res = await decideAppeal({ appealId, decision, note, revert });
    if (res.ok) {
      toast.success(decision === "accepted" ? `Einspruch angenommen${res.data.revert ? ` – ${res.data.revert.note}` : ""}` : "Einspruch abgelehnt");
      router.refresh();
    }
    return res;
  };
  return (
    <div className="flex flex-wrap gap-2">
      <ReasonDialog
        trigger={
          <Button size="sm">
            <Check /> Annehmen
          </Button>
        }
        title="Einspruch annehmen"
        description="Die Person erhält deine Begründung als Mitteilung und E-Mail."
        reasonLabel="Begründung"
        confirmLabel="Annehmen"
        onSubmit={submit("accepted")}
      >
        <Label className="flex items-start gap-2 text-sm font-normal">
          <Checkbox checked={revert} onCheckedChange={(v) => setRevert(v === true)} className="mt-0.5" />
          Massnahme rückgängig machen ({revertHint})
        </Label>
      </ReasonDialog>
      <ReasonDialog
        trigger={
          <Button size="sm" variant="secondary">
            <X /> Ablehnen
          </Button>
        }
        title="Einspruch ablehnen"
        reasonLabel="Begründung"
        confirmLabel="Ablehnen"
        destructive
        onSubmit={submit("rejected")}
      />
    </div>
  );
}
