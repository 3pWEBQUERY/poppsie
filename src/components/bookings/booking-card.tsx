"use client";

import type { BookingView } from "@/lib/bookings/types";

/** Buchungskarte im Chat mit aktuellem Status und Aktionen. Wird vom Buchungs-Modul implementiert. */
export function BookingCard({ booking }: { booking: BookingView; viewerId: string }) {
  return <div className="rounded-lg border bg-card p-3 text-sm">Buchung {booking.status}</div>;
}
