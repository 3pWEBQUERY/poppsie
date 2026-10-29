import type { SessionUser } from "@/lib/auth/session";

/** Berichte von Anbieterinnen über ein Mitglied – nur für Escorts/Clubs sichtbar. Wird vom Berichte-Modul implementiert. */
export async function MemberReviewSection(_props: { memberId: string; viewer: SessionUser | null }) {
  return null;
}
