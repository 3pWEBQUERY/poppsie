import "server-only";
import { db } from "@/db";
import { moderationFlags } from "@/db/schema";

/**
 * Automatische Upload-Prüfung. Hier werden externe Dienste angebunden:
 * Virenscan (z. B. ClamAV), Hash-Abgleich gegen bekannte illegale Inhalte (PhotoDNA / NCMEC),
 * Nacktheits- und Altersschätzung als Hinweis für Moderatoren.
 * Ohne konfigurierte Dienste wird nur die Liste BLOCKED_SHA256 (kommagetrennt) geprüft.
 */
export async function scanUpload(opts: { mediaId: string; ownerId: string; sha256: string; mime: string }) {
  const blocked = (process.env.BLOCKED_SHA256 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (blocked.includes(opts.sha256)) {
    await db.insert(moderationFlags).values({
      targetType: "media",
      targetId: opts.mediaId,
      targetUserId: opts.ownerId,
      reason: "illegal",
      priority: 100,
      details: "Automatischer Hash-Treffer",
      autoSignals: { hashMatch: true },
    });
    return { rejected: true as const };
  }
  return { rejected: false as const };
}
