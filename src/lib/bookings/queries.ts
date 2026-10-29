import type { BookingView } from "./types";

/** Buchungen für Buchungskarten laden (nur Beteiligte). Wird vom Buchungs-Modul implementiert. */
export async function getBookingViews(_ids: string[], _viewerId: string): Promise<Map<string, BookingView>> {
  return new Map();
}
