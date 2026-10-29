import type { SessionUser } from "@/lib/auth/session";

/** Berichte auf Profilseiten (Escort/Club). Wird vom Berichte-Modul implementiert. */
export async function ReviewSection(_props: { targetId: string; targetType: "escort" | "club"; viewer: SessionUser | null; sort?: string }) {
  return null;
}
