import "server-only";
import { requirePageUser } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Für gesperrte Dashboard-Seiten:
 *   const { user, locked } = await dashboardPage({ types: ["escort"] });
 *   if (locked) return <LockedNotice title="Statistiken" />;
 */
export async function dashboardPage(opts: { types?: SessionUser["accountType"][]; next?: string } = {}) {
  const user = await requirePageUser({ types: opts.types, next: opts.next });
  return { user, locked: !user.profileComplete };
}
