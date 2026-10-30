import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { decrypt } from "@/lib/auth/crypto";
import { verifyTotp } from "./totp";

export const DELETION_AUDIT_ACTION = "account.deletion_requested";
export const DELETION_GRACE_DAYS = 30;

/**
 * Anmeldung innerhalb der Löschfrist: Löschung zurücknehmen und den Sichtbarkeitszustand
 * von vor dem Löschantrag wiederherstellen (steht im Audit-Log).
 */
export async function restoreAfterDeletionRequest(userId: string) {
  const [last] = await db
    .select({ meta: auditLog.meta })
    .from(auditLog)
    .where(and(eq(auditLog.action, DELETION_AUDIT_ACTION), eq(auditLog.targetId, userId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  const wasHidden = last?.meta && typeof last.meta.profileWasHidden === "boolean" ? last.meta.profileWasHidden : true;
  await db.update(users).set({ deletionRequestedAt: null, profileHidden: wasHidden, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.insert(auditLog).values({ actorId: userId, action: "account.deletion_cancelled", targetType: "user", targetId: userId });
}

/** Gespeichertes TOTP-Secret (verschlüsselt) gegen einen Code prüfen. */
export function checkStoredTotp(stored: string, code: string) {
  try {
    return verifyTotp(decrypt(stored), code);
  } catch {
    return false;
  }
}
