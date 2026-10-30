import "server-only";
import type { ContentViewer } from "@/components/content/viewer-context";
import { isStaff } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { getSummary } from "@/lib/users/summary";

/** Kompakte Betrachter-Daten für die Client-Komponenten des Content-Moduls. */
export async function contentViewer(user: SessionUser | null): Promise<ContentViewer> {
  if (!user) return null;
  const s = await getSummary(user.id, user);
  return { id: user.id, username: user.username, name: s?.name ?? user.username, avatarUrl: s?.avatarUrl ?? null, href: s?.href ?? "#", complete: user.profileComplete, staff: isStaff(user) };
}
