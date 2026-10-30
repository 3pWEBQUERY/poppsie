export type BookingStatus = "requested" | "countered" | "confirmed" | "declined" | "cancelled" | "completed" | "no_show" | "expired";

/** Sicht auf eine Buchung für Buchungskarten im Chat und Listen. */
export type BookingView = {
  id: string;
  escortId: string;
  memberId: string;
  escortName: string;
  memberName: string;
  escortUsername: string;
  memberUsername: string;
  escortHref: string;
  memberHref: string;
  escortAvatarUrl: string | null;
  memberAvatarUrl: string | null;
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
  /** Reservierung aktiv (blocking = true). */
  blocking: boolean;
  timezone: string;
  conversationId: string | null;
  /** Mitglied hat zu dieser Buchung bereits einen Bericht geschrieben. */
  reviewed: boolean;
  createdAt: string;
};

export type DurationOption = { minutes: number; price: number };

export type BookingSettingsView = {
  timezone: string;
  bufferMin: number;
  minLeadMin: number;
  durations: DurationOption[];
  acceptsIncall: boolean;
  acceptsOutcall: boolean;
  enabled: boolean;
};

export type Slot = { start: string; end: string };
export type DaySlots = { date: string; slots: Slot[] };
