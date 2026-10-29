import "server-only";
import { requirePageUser } from "@/lib/auth/guards";

/** Für jede Admin-Seite (zusätzlich zum Layout, da Layouts bei Navigation nicht neu rendern). */
export function requireStaffPage(next = "/admin") {
  return requirePageUser({ roles: ["admin", "moderator"], next });
}
