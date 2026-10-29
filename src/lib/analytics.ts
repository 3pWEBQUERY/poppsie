import "server-only";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { sha256 } from "@/lib/auth/crypto";
import { clientIp, isBot, requestCountry } from "@/lib/request";

type EventType = (typeof analyticsEvents.$inferInsert)["type"];
type Source = NonNullable<(typeof analyticsEvents.$inferInsert)["source"]>;

/** Erfasst ein Statistik-Ereignis. Bots und eigene Aufrufe werden herausgefiltert. */
export async function track(profileId: string, type: EventType, opts: { viewerId?: string | null; source?: Source; refId?: string; country?: string | null } = {}) {
  if (opts.viewerId === profileId) return;
  if (await isBot()) return;
  const ip = await clientIp();
  const country = opts.country ?? (await requestCountry());
  await db.insert(analyticsEvents).values({
    profileId,
    type,
    source: opts.source ?? "direct",
    viewerId: opts.viewerId ?? null,
    viewerKey: opts.viewerId ?? sha256(`v:${ip}:${new Date().toISOString().slice(0, 10)}`).slice(0, 24),
    country,
    refId: opts.refId,
  });
}

export function sourceFromParam(v: string | null | undefined): Source {
  const allowed: Source[] = ["search", "feed", "story", "matches", "favorites", "profile", "external", "direct"];
  return allowed.includes(v as Source) ? (v as Source) : "direct";
}
