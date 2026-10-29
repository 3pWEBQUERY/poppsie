"use client";

import { useState, useTransition } from "react";
import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/shared/select/select";
import { StarRating } from "@/components/shared/star-rating";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createReview } from "@/lib/reviews/actions";
import { REVIEW_DURATIONS, type Criterion } from "@/lib/reviews/criteria";

type BookingOption = { id: string; label: string; date: string; durationMin: number };

/** Bericht schreiben: Gesamt + Teilbewertungen, Titel, Text, Datum und Dauer des Treffens. */
export function ReviewForm({
  target,
  criteria,
  bookings,
  initialBookingId,
  today,
}: {
  target: { id: string; name: string };
  criteria: Criterion[];
  bookings: BookingOption[];
  initialBookingId?: string;
  today: string;
}) {
  const router = useRouter();
  const handleLocked = useLockedHandler();
  const [pending, start] = useTransition();
  const [rating, setRating] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(bookings.some((b) => b.id === initialBookingId) ? initialBookingId! : (bookings[0]?.id ?? null));
  const booking = bookings.find((b) => b.id === bookingId);
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState<string | null>("60");

  const submit = () =>
    start(async () => {
      if (!rating) return void toast.error("Bitte vergib eine Gesamtbewertung");
      const res = await createReview({
        targetId: target.id,
        rating,
        ratings,
        title,
        body,
        bookingId: bookingId ?? undefined,
        meetingDate: booking ? undefined : date || undefined,
        durationMin: booking ? undefined : duration ? Number(duration) : undefined,
      });
      if (handleLocked(res)) return;
      if (!res.ok) return void toast.error(res.error);
      toast.success("Danke für deinen Bericht!");
      router.push(res.data.href);
    });

  return (
    <div className="flex flex-col gap-5 rounded-lg border bg-card p-4 sm:p-6">
      {bookings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Verknüpfte Buchung</Label>
          <Select
            options={[...bookings.map((b) => ({ value: b.id, label: b.label })), { value: "none", label: "Ohne Buchung berichten" }]}
            value={bookingId ?? "none"}
            onChange={(v) => setBookingId(v && v !== "none" ? v : null)}
            aria-label="Verknüpfte Buchung"
          />
          {booking && (
            <p className="inline-flex items-center gap-1.5 text-xs text-success">
              <BadgeCheck className="size-4" /> Dein Bericht erhält das Label „Verifiziertes Treffen“.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Gesamtbewertung</Label>
        <StarRating value={rating} onChange={setRating} size="md" label="Gesamtbewertung" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {criteria.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span className="text-sm">{c.label}</span>
            <StarRating value={ratings[c.key] ?? 0} onChange={(v) => setRatings({ ...ratings, [c.key]: v })} label={c.label} />
          </div>
        ))}
      </div>

      {!booking && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rv-date">Datum des Treffens</Label>
            <Input id="rv-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Dauer</Label>
            <Select options={REVIEW_DURATIONS} value={duration} onChange={setDuration} aria-label="Dauer des Treffens" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rv-title">Titel</Label>
        <Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={`z. B. Unvergesslicher Abend mit ${target.name}`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rv-body">Dein Bericht</Label>
        <Textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={8} placeholder="Wie war das Treffen? Bitte bleib respektvoll und nenne keine privaten Daten." />
        <span className="text-xs text-muted-foreground">{body.trim().length} / mind. 30 Zeichen</span>
      </div>
      <p className="text-xs text-muted-foreground">Pro Profil ist alle 30 Tage ein Bericht möglich. Die bewertete Person kann einmal öffentlich antworten, aber nicht löschen.</p>
      <Button size="lg" className="self-start" disabled={pending} onClick={submit}>
        Bericht veröffentlichen
      </Button>
    </div>
  );
}
