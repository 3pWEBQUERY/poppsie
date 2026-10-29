import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getDeletedSystemUser, purgeAccount, purgeExpiredAccounts } from "@/lib/account/purge";
import type { JobHandler, Periodic } from "./types";

/**
 * Konto-Jobs. Läuft im Worker ausserhalb von Next: keine Module mit next/headers.
 * - account.purge: einzelnes Konto sofort endgültig löschen (z. B. aus einem Admin-Werkzeug)
 * - täglich: Konten mit Löschantrag älter als 30 Tage entfernen
 */
export const handlers: Record<string, JobHandler> = {
  "account.purge": async (payload) => {
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    if (!userId) throw new Error("userId fehlt");
    // Nur Konten mit Löschantrag; schützt vor versehentlich eingereihten Jobs
    const [u] = await db.select({ requested: users.deletionRequestedAt }).from(users).where(eq(users.id, userId));
    if (!u?.requested) return;
    await purgeAccount(userId, await getDeletedSystemUser());
  },
};

export const periodic: Periodic[] = [
  {
    name: "account.purge-deleted",
    everyMs: 24 * 3600_000,
    run: async () => {
      await purgeExpiredAccounts();
    },
  },
];
