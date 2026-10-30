import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviews, users } from "@/db/schema";

/** Bekannte Abzeichen (users.badges) mit Anzeigenamen. */
export const BADGE_LABELS: Record<string, string> = {
  verified_reviewer: "Verifizierter Berichtschreiber",
  top_reviewer: "Top-Berichtschreiber",
  verified: "Verifiziertes Mitglied",
  early_member: "Mitglied der ersten Stunde",
  trusted: "Vertrauenswürdig",
};

/** Abzeichen eines Users; "Verifizierter Berichtschreiber" ergibt sich zusätzlich aus verifizierten Berichten. */
export async function badgeLabels(u: Pick<typeof users.$inferSelect, "id" | "badges">) {
  const out = new Set(u.badges.map((b) => BADGE_LABELS[b] ?? b));
  const [r] = await db
    .select({ n: count() })
    .from(reviews)
    .where(and(eq(reviews.authorId, u.id), eq(reviews.verified, true), eq(reviews.hidden, false)));
  if ((r?.n ?? 0) > 0) out.add(BADGE_LABELS.verified_reviewer!);
  return [...out];
}
