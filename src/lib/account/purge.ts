import { and, eq, isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, media, reviews, users } from "@/db/schema";
import { randomToken } from "@/lib/auth/crypto";
import { deleteObject } from "@/lib/storage";

/**
 * Endgültige Kontolöschung nach Ablauf der 30-Tage-Frist.
 * Läuft im Job-Worker: kein next/headers (also kein audit()/clientIp, Audit direkt in die Tabelle).
 */
export const PURGE_AFTER_DAYS = 30;
const SYSTEM_USERNAME = "geloescht";
const SYSTEM_EMAIL = "geloescht@system.invalid";

/** Systemkonto, dem anonymisierte Berichte zugeordnet werden (Status deleted, kann sich nie anmelden). */
export async function getDeletedSystemUser() {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, SYSTEM_EMAIL), and(eq(users.username, SYSTEM_USERNAME), eq(users.status, "deleted"))));
  if (existing) return existing.id;
  const values = {
    email: SYSTEM_EMAIL,
    // Kein gültiger Argon2-Hash: verifyPassword schlägt immer fehl
    passwordHash: `!disabled:${randomToken(16)}`,
    accountType: "member" as const,
    status: "deleted" as const,
    profileHidden: true,
    profileComplete: false,
    showOnline: false,
  };
  const [row] = await db
    .insert(users)
    .values({ ...values, username: SYSTEM_USERNAME })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (row) return row.id;
  // Benutzername schon vergeben (echtes Konto): Ausweichname
  const [fallback] = await db
    .insert(users)
    .values({ ...values, username: `${SYSTEM_USERNAME}_${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "")}` })
    .returning({ id: users.id });
  return fallback!.id;
}

/** Ein Konto endgültig entfernen: Speicherobjekte löschen, Berichte anonymisieren, User-Zeile löschen (Cascade). */
export async function purgeAccount(userId: string, systemUserId: string) {
  const files = await db
    .select({ storageKey: media.storageKey, thumbKey: media.thumbKey, blurKey: media.blurKey })
    .from(media)
    .where(eq(media.ownerId, userId));
  let failed = 0;
  for (const f of files) {
    for (const key of [f.storageKey, f.thumbKey, f.blurKey]) {
      if (!key) continue;
      try {
        await deleteObject(key);
      } catch (err) {
        failed++;
        console.error(`[account] Speicherobjekt ${key} konnte nicht gelöscht werden`, err);
      }
    }
  }
  if (failed > 0) throw new Error(`${failed} Speicherobjekte konnten nicht gelöscht werden`);
  const anonymized = await db.update(reviews).set({ authorId: systemUserId, bookingId: null }).where(eq(reviews.authorId, userId)).returning({ id: reviews.id });
  await db.delete(users).where(eq(users.id, userId));
  await db.insert(auditLog).values({
    actorId: null,
    action: "account.purged",
    targetType: "user",
    targetId: userId,
    meta: { mediaFiles: files.length, reviewsAnonymized: anonymized.length },
  });
  return { mediaFiles: files.length, reviewsAnonymized: anonymized.length };
}

/** Alle Konten mit abgelaufener Löschfrist entfernen. */
export async function purgeExpiredAccounts(now = new Date()) {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * 86400_000);
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNotNull(users.deletionRequestedAt), lt(users.deletionRequestedAt, cutoff)))
    .limit(200);
  if (!due.length) return { purged: 0 };
  const systemUserId = await getDeletedSystemUser();
  let purged = 0;
  for (const u of due) {
    if (u.id === systemUserId) continue;
    try {
      await purgeAccount(u.id, systemUserId);
      purged++;
    } catch (err) {
      console.error(`[account] Löschung von ${u.id} fehlgeschlagen`, err);
    }
  }
  if (purged) console.log(`[account] ${purged} Konto/Konten endgültig gelöscht`);
  return { purged };
}
