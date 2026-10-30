"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { CalendarClock, CalendarDays, Clock, Hourglass, MapPin, PenLine, Star } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { changeBooking, fetchBooking } from "@/lib/bookings/actions";
import { STATUS_LABEL, STATUS_VARIANT, durationLabel, fmtRange, fmtTime } from "@/lib/bookings/format";
import { ACTION_LABEL, allowedActions, type BookingAction } from "@/lib/bookings/rules";
import type { BookingView, Slot } from "@/lib/bookings/types";
import { cn, formatPrice } from "@/lib/utils";
import { SlotPicker } from "./slot-picker";

const PRIMARY: BookingAction[] = ["confirm", "accept", "complete"];
const DANGER: BookingAction[] = ["decline", "reject_counter", "cancel", "no_show"];

/** Buchungskarte im Chat mit aktuellem Status und Aktionen. Aktualisiert sich bei `booking.updated`. */
export function BookingCard({ booking, viewerId, className }: { booking: BookingView; viewerId: string; className?: string }) {
  const [b, setB] = useState(booking);
  const [pending, start] = useTransition();
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterSlot, setCounterSlot] = useState<Slot | null>(null);
  const handleLocked = useLockedHandler();

  // Neue Daten von aussen (z. B. Messenger lädt neu) übernehmen
  const [prop, setProp] = useState(booking);
  if (prop !== booking) {
    setProp(booking);
    setB(booking);
  }

  const refresh = useCallback(async () => {
    const res = await fetchBooking(booking.id);
    if (res.ok) setB(res.data);
  }, [booking.id]);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const ev = (e as CustomEvent).detail as { type?: string; bookingId?: string };
      if (ev?.type === "booking.updated" && ev.bookingId === booking.id) void refresh();
    };
    window.addEventListener("pp:realtime", onEvent);
    return () => window.removeEventListener("pp:realtime", onEvent);
  }, [booking.id, refresh]);

  const isEscort = viewerId === b.escortId;
  const other = isEscort
    ? { name: b.memberName, avatarUrl: b.memberAvatarUrl, href: b.memberHref }
    : { name: b.escortName, avatarUrl: b.escortAvatarUrl, href: b.escortHref };
  const actions = allowedActions(b, viewerId);
  const tz = b.timezone;
  // Abgelaufene Reservierungen gibt der Worker frei (blocking = false) und sendet booking.updated
  const holdActive = b.status === "requested" && b.blocking && Boolean(b.holdUntil);

  const act = (action: BookingAction, counterStart?: string) =>
    start(async () => {
      const res = await changeBooking({ id: b.id, action, counterStart });
      if (handleLocked(res)) return;
      if (!res.ok) {
        toast.error(res.error);
        void refresh();
        return;
      }
      setB(res.data);
      setCounterOpen(false);
      toast.success(action === "counter" ? "Gegenvorschlag gesendet" : `Status: ${STATUS_LABEL[res.data.status]}`);
    });

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-3 rounded-lg border bg-card p-4 text-sm", className)} data-booking-id={b.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <CalendarDays className="size-4 text-primary" /> Buchung
        </span>
        <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <UserAvatar user={other} size="sm" link />
        <div className="min-w-0">
          <Link href={other.href} className="block truncate font-semibold hover:underline">
            {other.name}
          </Link>
          <span className="text-xs text-muted-foreground">{isEscort ? "fragt bei dir an" : "Deine Anfrage"}</span>
        </div>
      </div>

      <dl className="grid gap-1.5">
        <div className={cn("flex items-start gap-2", b.status === "countered" && "text-muted-foreground line-through")}>
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{fmtRange(b.start, b.end, tz)}</span>
        </div>
        {b.status === "countered" && b.counterStart && b.counterEnd && (
          <div className="flex items-start gap-2 font-semibold text-warning">
            <CalendarClock className="mt-0.5 size-4 shrink-0" />
            <span>Neuer Vorschlag: {fmtRange(b.counterStart, b.counterEnd, tz)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Hourglass className="size-4 shrink-0 text-muted-foreground" />
          <span>
            {durationLabel(b.durationMin)}
            {b.price ? ` · ${formatPrice(b.price, b.currency)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span>{b.meetingType === "incall" ? "Incall (bei ihr)" : "Outcall (Besuch bei dir)"}</span>
        </div>
      </dl>

      {b.message && <p className="rounded-md border bg-background px-3 py-2 whitespace-pre-wrap text-muted-foreground">{b.message}</p>}

      {b.status === "requested" && (
        <p className="text-xs text-muted-foreground">
          {holdActive ? `Termin reserviert bis ${fmtTime(b.holdUntil!, tz)} Uhr.` : "Reservierung abgelaufen – der Termin kann bestätigt werden, solange er frei ist."}
        </p>
      )}

      {(actions.length > 0 || b.status === "completed") && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) =>
            a === "counter" ? (
              <Button key={a} size="sm" variant="secondary" disabled={pending} onClick={() => setCounterOpen(true)}>
                {ACTION_LABEL[a]}
              </Button>
            ) : (
              <Button key={a} size="sm" variant={PRIMARY.includes(a) ? "default" : DANGER.includes(a) ? "outline" : "secondary"} disabled={pending} onClick={() => act(a)}>
                {ACTION_LABEL[a]}
              </Button>
            ),
          )}
          {b.status === "completed" && !isEscort && !b.reviewed && (
            <Button size="sm" asChild>
              <Link href={`/escort/${b.escortUsername}/bericht?buchung=${b.id}`}>
                <PenLine /> Bericht schreiben
              </Link>
            </Button>
          )}
          {b.status === "completed" && !isEscort && b.reviewed && <span className="text-xs text-muted-foreground">Danke für deinen Bericht!</span>}
          {b.status === "completed" && isEscort && (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`${b.memberHref}#mitglied-berichte`}>
                <Star /> Mitglied bewerten
              </Link>
            </Button>
          )}
        </div>
      )}

      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gegenvorschlag</DialogTitle>
            <DialogDescription>Wähle eine andere freie Zeit ({durationLabel(b.durationMin)}). {b.memberName} kann annehmen oder ablehnen.</DialogDescription>
          </DialogHeader>
          {counterOpen && <SlotPicker escortId={b.escortId} durationMin={b.durationMin} timezone={tz} value={counterSlot} onChange={setCounterSlot} excludeBookingId={b.id} compact />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterOpen(false)}>
              Abbrechen
            </Button>
            <Button disabled={!counterSlot || pending} onClick={() => counterSlot && act("counter", counterSlot.start)}>
              Vorschlag senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
