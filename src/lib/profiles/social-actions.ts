"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { follows, profileVisits, users } from "@/db/schema";
import { sourceFromParam, track } from "@/lib/analytics";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { limitOrThrow, writeLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { getSummary } from "@/lib/users/summary";
import { canViewProfile } from "@/lib/visibility";
import { zurichToday } from "./hours";

/** Folgen / Entfolgen. Gibt den neuen Zustand zurück. */
export async function toggleFollow(targetId: string) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    z.uuid().parse(targetId);
    if (targetId === user.id) throw new ApiError("INVALID", "Du kannst dir nicht selbst folgen");
    await writeLimit(user.id, "follow");
    const [target] = await db.select().from(users).where(eq(users.id, targetId));
    if (!target || !(await canViewProfile(user, target))) throw new ApiError("NOT_FOUND");
    const where = and(eq(follows.followerId, user.id), eq(follows.followeeId, targetId));
    const existing = await db.select({ x: follows.followerId }).from(follows).where(where);
    if (existing.length) {
      await db.delete(follows).where(where);
      return { following: false };
    }
    await db.insert(follows).values({ followerId: user.id, followeeId: targetId }).onConflictDoNothing();
    await track(targetId, "follow", { viewerId: user.id, source: "profile" });
    if (!user.incognito) {
      const me = await getSummary(user.id, user);
      await notify(targetId, { type: "follow", title: `${me?.name ?? user.username} folgt dir jetzt`, href: me?.href, actorId: user.id });
    }
    return { following: true };
  });
}

/**
 * Profilbesuch erfassen (vom Client nach dem Laden der Seite, damit Prefetches nicht zählen).
 * Ein Eintrag pro Besucher, Profil und Tag; Gäste und eigene Aufrufe zählen nicht als Besucher.
 */
export async function recordProfileVisit(targetId: string, src?: string | null) {
  return run(async () => {
    z.uuid().parse(targetId);
    const viewer = await getSessionUser();
    const [target] = await db.select().from(users).where(eq(users.id, targetId));
    if (!target || !(await canViewProfile(viewer, target))) throw new ApiError("NOT_FOUND");
    if (viewer?.id === targetId) return { recorded: false };
    await limitOrThrow(`visit:${viewer?.id ?? await clientIp()}:${targetId}`, 30, 3600);
    if (viewer) {
      await db
        .insert(profileVisits)
        .values({ visitorId: viewer.id, visitedId: targetId, visitDate: zurichToday(), incognito: viewer.incognito })
        .onConflictDoUpdate({
          target: [profileVisits.visitorId, profileVisits.visitedId, profileVisits.visitDate],
          set: { count: sql`${profileVisits.count} + 1`, lastVisitedAt: new Date(), incognito: viewer.incognito },
        });
    }
    await track(targetId, "profile_view", { viewerId: viewer?.id ?? null, source: sourceFromParam(src) });
    return { recorded: true };
  });
}
