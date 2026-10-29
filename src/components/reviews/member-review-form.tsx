"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StarRating } from "@/components/shared/star-rating";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createMemberReview } from "@/lib/reviews/actions";
import { cn } from "@/lib/utils";

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1" role="group" aria-label={label}>
        {[
          [true, "Ja"],
          [false, "Nein"],
        ].map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(value === v ? null : (v as boolean))}
            className={cn("rounded-md border px-3 py-1 text-xs font-medium", value === v ? (v ? "border-success bg-success/15 text-success" : "border-destructive bg-destructive/15 text-destructive") : "border-border")}
          >
            {l as string}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Anbieterin bewertet ein Mitglied (zuverlässig, respektvoll, Sterne, Text). */
export function MemberReviewForm({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const handleLocked = useLockedHandler();
  const [pending, start] = useTransition();
  const [rating, setRating] = useState(0);
  const [reliable, setReliable] = useState<boolean | null>(null);
  const [respectful, setRespectful] = useState<boolean | null>(null);
  const [body, setBody] = useState("");

  const submit = () =>
    start(async () => {
      if (!rating) return void toast.error("Bitte vergib Sterne");
      const res = await createMemberReview({ memberId, rating, reliable, respectful, body: body || undefined });
      if (handleLocked(res)) return;
      if (!res.ok) return void toast.error(res.error);
      toast.success("Bewertung gespeichert");
      setRating(0);
      setBody("");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-background p-3">
      <span className="text-sm font-semibold">{memberName} bewerten</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <YesNo label="Zuverlässig" value={reliable} onChange={setReliable} />
        <YesNo label="Respektvoll" value={respectful} onChange={setRespectful} />
      </div>
      <StarRating value={rating} onChange={setRating} size="md" label="Gesamtbewertung" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} placeholder="Kurzer Hinweis für andere Anbieterinnen (optional)" />
      <Button size="sm" className="self-start" disabled={pending} onClick={submit}>
        Bewertung speichern
      </Button>
    </div>
  );
}
