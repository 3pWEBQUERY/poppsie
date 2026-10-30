"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Home, Car } from "lucide-react";
import { toast } from "sonner";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBookingRequest } from "@/lib/bookings/actions";
import { durationLabel, fmtRange } from "@/lib/bookings/format";
import type { BookingSettingsView, Slot } from "@/lib/bookings/types";
import { cn, formatPrice } from "@/lib/utils";
import { SlotPicker } from "./slot-picker";

type Props = {
  escort: { id: string; name: string; username: string };
  settings: BookingSettingsView;
  currency: string;
  viewer: { loggedIn: boolean; isMember: boolean };
};

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", done ? "bg-primary text-primary-foreground" : "bg-secondary")}>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Buchungsablauf: Dauer → freie Slots → Incall/Outcall → Nachricht → Anfrage senden. */
export function BookingWizard({ escort, settings, currency, viewer }: Props) {
  const [duration, setDuration] = useState<number | null>(settings.durations.length === 1 ? settings.durations[0]!.minutes : null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [meeting, setMeeting] = useState<"incall" | "outcall">(settings.acceptsIncall ? "incall" : "outcall");
  const [message, setMessage] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [done, setDone] = useState<{ conversationId: string } | null>(null);
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const price = settings.durations.find((d) => d.minutes === duration)?.price ?? 0;

  const submit = () =>
    start(async () => {
      if (!duration || !slot) return;
      const res = await createBookingRequest({ escortId: escort.id, durationMin: duration, start: slot.start, meetingType: meeting, message: message || undefined });
      if (handleLocked(res)) return;
      if (!res.ok) {
        toast.error(res.error);
        if (res.code === "CONFLICT") {
          setSlot(null);
          setPickerKey((k) => k + 1);
        }
        return;
      }
      setDone({ conversationId: res.data.conversationId });
      window.scrollTo({ top: 0 });
    });

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-12 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <h2 className="text-xl font-bold">Anfrage gesendet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Dein Wunschtermin ist 30 Minuten für dich reserviert. {escort.name} bestätigt, macht einen Gegenvorschlag oder lehnt ab – du wirst benachrichtigt. Im Chat könnt ihr die Details absprechen.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={`/dashboard/nachrichten?c=${done.conversationId}`}>Zum Chat</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/dashboard/kalender">Meine Termine</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Step n={1} title="Dauer wählen" done={Boolean(duration)}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {settings.durations.map((d) => (
            <button
              key={d.minutes}
              type="button"
              aria-pressed={duration === d.minutes}
              onClick={() => {
                setDuration(d.minutes);
                setSlot(null);
              }}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 transition-colors",
                duration === d.minutes ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40",
              )}
            >
              <span className="font-display text-lg font-bold">{durationLabel(d.minutes)}</span>
              <span className="text-xs text-muted-foreground">{d.price ? formatPrice(d.price, currency) : "Preis auf Anfrage"}</span>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="Termin wählen" done={Boolean(slot)}>
        {duration ? (
          <SlotPicker key={`${duration}-${pickerKey}`} escortId={escort.id} durationMin={duration} timezone={settings.timezone} value={slot} onChange={setSlot} />
        ) : (
          <p className="text-sm text-muted-foreground">Wähle zuerst eine Dauer.</p>
        )}
      </Step>

      <Step n={3} title="Treffpunkt" done={Boolean(slot)}>
        <div className="grid gap-2 sm:grid-cols-2">
          {settings.acceptsIncall && (
            <MeetingOption active={meeting === "incall"} onClick={() => setMeeting("incall")} icon={<Home />} title="Incall" text={`Du besuchst ${escort.name}`} />
          )}
          {settings.acceptsOutcall && (
            <MeetingOption active={meeting === "outcall"} onClick={() => setMeeting("outcall")} icon={<Car />} title="Outcall" text={`${escort.name} besucht dich (Hotel/Wohnung)`} />
          )}
        </div>
      </Step>

      <Step n={4} title="Nachricht & senden">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-message">Nachricht an {escort.name} (optional)</Label>
          <Textarea id="booking-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} placeholder="Wünsche, Hotel, Anreise …" />
        </div>
        {duration && slot && (
          <div className="rounded-md border bg-background px-3 py-2 text-sm">
            <div className="font-semibold">{fmtRange(slot.start, slot.end, settings.timezone)}</div>
            <div className="text-muted-foreground">
              {durationLabel(duration)} · {meeting === "incall" ? "Incall" : "Outcall"}
              {price ? ` · ${formatPrice(price, currency)} (Bezahlung vor Ort)` : ""}
            </div>
          </div>
        )}
        {!viewer.loggedIn ? (
          <Button asChild className="self-start">
            <Link href={`/anmelden?next=${encodeURIComponent(`/escort/${escort.username}/buchen`)}`}>Anmelden, um anzufragen</Link>
          </Button>
        ) : !viewer.isMember ? (
          <p className="text-sm text-muted-foreground">Termine können nur Mitglieder anfragen.</p>
        ) : (
          <Button className="self-start" size="lg" disabled={!duration || !slot || pending} onClick={submit}>
            Anfrage senden
          </Button>
        )}
      </Step>
    </div>
  );
}

function MeetingOption({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors [&_svg]:size-5", active ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40")}
    >
      <span className="text-primary">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}
