/** Beschriftungen für Moderation und Admin-Bereich (auch im Client nutzbar). */

export const FLAG_REASONS = ["minor", "coercion", "trafficking", "spam", "abuse", "fake", "privacy", "illegal", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const FLAG_TARGETS = ["profile", "post", "comment", "review", "message", "story", "group", "thread", "media"] as const;
export type FlagTarget = (typeof FLAG_TARGETS)[number];

export const FLAG_STATUSES = ["open", "in_review", "resolved", "dismissed"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const URGENT_REASONS = new Set<string>(["minor", "coercion", "trafficking"]);

export const REASON_LABEL: Record<FlagReason, string> = {
  minor: "Verdacht auf Minderjährigkeit",
  coercion: "Verdacht auf Zwang",
  trafficking: "Verdacht auf Menschenhandel",
  spam: "Spam / Werbung",
  abuse: "Beleidigung / Belästigung",
  fake: "Fake / falsche Angaben",
  privacy: "Privatsphäre verletzt",
  illegal: "Illegaler Inhalt",
  other: "Anderer Grund",
};

export const TARGET_LABEL: Record<FlagTarget, string> = {
  profile: "Profil",
  post: "Beitrag",
  comment: "Kommentar",
  review: "Bericht",
  message: "Nachricht",
  story: "Story",
  group: "Gruppe",
  thread: "Forum-Thread",
  media: "Medium",
};

export const STATUS_LABEL: Record<FlagStatus, string> = {
  open: "Offen",
  in_review: "In Prüfung",
  resolved: "Erledigt",
  dismissed: "Verworfen",
};

export const ACTION_TYPES = [
  "warn",
  "remove_content",
  "suspend_temp",
  "suspend_perm",
  "unsuspend",
  "kyc_approve",
  "kyc_reject",
  "hide_profile",
  "restore_profile",
] as const;
export type ModerationActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABEL: Record<ModerationActionType, string> = {
  warn: "Verwarnung",
  remove_content: "Inhalt entfernt",
  suspend_temp: "Temporäre Sperre",
  suspend_perm: "Permanente Sperre",
  unsuspend: "Sperre aufgehoben",
  kyc_approve: "Verifikation bestätigt",
  kyc_reject: "Verifikation abgelehnt",
  hide_profile: "Profil ausgeblendet",
  restore_profile: "Profil wiederhergestellt",
};

/** Aktionen, gegen die ein Einspruch sinnvoll ist. */
export const APPEALABLE = new Set<ModerationActionType>(["warn", "remove_content", "suspend_temp", "suspend_perm", "kyc_reject", "hide_profile"]);

export const APPEAL_STATUS_LABEL = { open: "Offen", accepted: "Angenommen", rejected: "Abgelehnt" } as const;

export const ACCOUNT_TYPE_LABEL = { member: "Mitglied", escort: "Escort", club: "Club / Studio" } as const;
export const ROLE_LABEL = { user: "Benutzer", moderator: "Moderator", admin: "Admin" } as const;
export const USER_STATUS_LABEL = { pending: "Ausstehend", active: "Aktiv", suspended: "Gesperrt", deleted: "Gelöscht" } as const;
export const KYC_LABEL = { none: "Keine", pending: "In Prüfung", verified: "Verifiziert", rejected: "Abgelehnt" } as const;

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zurich" });
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

/** Alter in Jahren aus einem ISO-Datum (YYYY-MM-DD). */
export function ageFrom(birthDate: string | null | undefined, now = new Date()) {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

/** «vor 5 Min.», «vor 3 Std.», «vor 2 Tagen». */
export function timeAgo(d: Date | string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  const days = Math.floor(s / 86400);
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}
