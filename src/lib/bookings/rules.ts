import type { BookingStatus } from "./types";

/** Status-Übergänge (rein, auch im Client für die Buttons). */
export type BookingAction = "confirm" | "counter" | "decline" | "accept" | "reject_counter" | "cancel" | "complete" | "no_show";

type Ctx = { status: BookingStatus; start: string; escortId: string; memberId: string };

export function allowedActions(b: Ctx, viewerId: string, now = Date.now()): BookingAction[] {
  const started = new Date(b.start).getTime() <= now;
  const out: BookingAction[] = [];
  if (viewerId === b.escortId) {
    if (b.status === "requested" && !started) out.push("confirm", "counter", "decline");
    if (b.status === "countered") out.push("decline");
    if (b.status === "confirmed" && !started) out.push("cancel");
    if (b.status === "confirmed" && started) out.push("complete", "no_show");
  } else if (viewerId === b.memberId) {
    if (b.status === "countered") out.push("accept", "reject_counter");
    if ((b.status === "requested" || b.status === "confirmed") && !started) out.push("cancel");
  }
  return out;
}

export const ACTION_LABEL: Record<BookingAction, string> = {
  confirm: "Bestätigen",
  counter: "Gegenvorschlag",
  decline: "Ablehnen",
  accept: "Annehmen",
  reject_counter: "Ablehnen",
  cancel: "Absagen",
  complete: "Erledigt",
  no_show: "Nicht erschienen",
};

export const NEXT_STATUS: Record<Exclude<BookingAction, "counter">, BookingStatus> = {
  confirm: "confirmed",
  decline: "declined",
  accept: "confirmed",
  reject_counter: "declined",
  cancel: "cancelled",
  complete: "completed",
  no_show: "no_show",
};
