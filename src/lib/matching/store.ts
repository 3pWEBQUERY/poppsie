import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { preferences } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { cleanCriteria, CriteriaSchema, type Criteria } from "./criteria";

/** Präferenzen entschlüsseln; null, wenn keine (gültigen) gespeichert sind. */
export async function loadCriteria(userId: string): Promise<{ criteria: Criteria; updatedAt: Date } | null> {
  const [row] = await db.select().from(preferences).where(eq(preferences.userId, userId));
  if (!row) return null;
  try {
    const parsed = CriteriaSchema.safeParse(JSON.parse(decrypt(row.criteriaEnc)));
    return parsed.success ? { criteria: cleanCriteria(parsed.data), updatedAt: row.updatedAt } : null;
  } catch {
    return null;
  }
}

/** Präferenzen verschlüsselt (AES-256-GCM) speichern. */
export async function storeCriteria(userId: string, criteria: Criteria) {
  const criteriaEnc = encrypt(JSON.stringify(cleanCriteria(criteria)));
  const updatedAt = new Date();
  await db.insert(preferences).values({ userId, criteriaEnc, updatedAt }).onConflictDoUpdate({ target: preferences.userId, set: { criteriaEnc, updatedAt } });
}

export async function deleteCriteria(userId: string) {
  await db.delete(preferences).where(eq(preferences.userId, userId));
}
