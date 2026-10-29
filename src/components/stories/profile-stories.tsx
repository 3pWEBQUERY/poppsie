import type { SessionUser } from "@/lib/auth/session";

/** Story-Highlights und "Story ansehen" auf Profilseiten. Wird vom Community-Modul implementiert. */
export async function ProfileStories(_props: { userId: string; viewer: SessionUser | null }) {
  return null;
}
