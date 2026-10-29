export type BookingStatus = "requested" | "countered" | "confirmed" | "declined" | "cancelled" | "completed" | "no_show" | "expired";

/** Sicht auf eine Buchung für Buchungskarten im Chat und Listen. */
export type BookingView = {
  id: string;
  escortId: string;
  memberId: string;
  escortName: string;
  memberName: string;
  start: string; // ISO
  end: string; // ISO
  counterStart?: string | null;
  counterEnd?: string | null;
  durationMin: number;
  price: number | null;
  currency: string;
  meetingType: "incall" | "outcall";
  message: string | null;
  status: BookingStatus;
  holdUntil: string | null;
  timezone: string;
};
