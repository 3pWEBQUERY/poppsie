"use server";

import { and, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clubLinks, clubProfiles, escortProfiles, users } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { writeLimit } from "@/lib/rate-limit";
import { getSummaries, getSummary } from "@/lib/users/summary";
import { isBlockedBetween } from "@/lib/visibility";
import { zurichToday } from "./hours";

const gate = () => requireUser({ complete: true, types: ["escort", "club"] });

/** Schlüssel (clubId, escortId) aus Sicht des Users. */
function pair(user: SessionUser, otherId: string) {
  return user.accountType === "club" ? { clubId: user.id, escortId: otherId } : { clubId: otherId, escortId: user.id };
}

const whereLink = (p: { clubId: string; escortId: string }) => and(eq(clubLinks.clubId, p.clubId), eq(clubLinks.escortId, p.escortId));

export type LinkCandidate = { id: string; name: string; username: string; avatarUrl: string | null; href: string; verified: boolean; status: "pending" | "accepted" | "rejected" | null };

/** Escorts suchen Clubs (Name), Clubs suchen Escorts (Benutzername oder Anzeigename). */
export async function searchLinkTargets(q: string) {
  return run(async (): Promise<LinkCandidate[]> => {
    const user = await gate();
    const term = z.string().trim().min(2, "Mindestens 2 Zeichen").max(60).parse(q);
    await writeLimit(user.id, "link-search", 120);
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const base = and(eq(users.status, "active"), eq(users.kycStatus, "verified"), eq(users.profileHidden, false), ne(users.id, user.id));
    const rows =
      user.accountType === "escort"
        ? await db
            .select({ id: users.id })
            .from(clubProfiles)
            .innerJoin(users, eq(users.id, clubProfiles.userId))
            .where(and(base, or(ilike(clubProfiles.name, like), ilike(clubProfiles.slug, like), ilike(users.username, like))))
            .limit(10)
        : await db
            .select({ id: users.id })
            .from(escortProfiles)
            .innerJoin(users, eq(users.id, escortProfiles.userId))
            .where(and(base, or(ilike(users.username, like), ilike(escortProfiles.displayName, like))))
            .limit(10);
    const ids = rows.map((r) => r.id);
    const summaries = await getSummaries(ids, user);
    const links = ids.length
      ? await db
          .select()
          .from(clubLinks)
          .where(
            user.accountType === "club"
              ? and(eq(clubLinks.clubId, user.id), inArray(clubLinks.escortId, ids))
              : and(eq(clubLinks.escortId, user.id), inArray(clubLinks.clubId, ids)),
          )
      : [];
    return ids.flatMap((id) => {
      const s = summaries.get(id);
      if (!s) return [];
      const l = links.find((x) => x.clubId === id || x.escortId === id);
      return [{ id, name: s.name, username: s.username, avatarUrl: s.avatarUrl, href: s.href, verified: s.verified, status: l?.status ?? null }];
    });
  });
}

/** Anfrage (Escort → Club) bzw. Einladung (Club → Escort). Gegenanfrage wird direkt bestätigt. */
export async function requestLink(otherId: string) {
  return run(async () => {
    const user = await gate();
    z.uuid().parse(otherId);
    await writeLimit(user.id, "link-request", 30, 3600);
    const [other] = await db.select().from(users).where(eq(users.id, otherId));
    const wanted = user.accountType === "club" ? "escort" : "club";
    if (!other || other.accountType !== wanted || other.status !== "active") throw new ApiError("NOT_FOUND", "Profil nicht gefunden");
    if (await isBlockedBetween(user.id, otherId)) throw new ApiError("FORBIDDEN", "Nicht möglich");
    const p = pair(user, otherId);
    const [existing] = await db.select().from(clubLinks).where(whereLink(p));
    const me = await getSummary(user.id, user);
    if (existing?.status === "accepted") return { status: "accepted" as const };
    if (existing?.status === "pending" && existing.initiatedBy !== user.id) {
      await db.update(clubLinks).set({ status: "accepted" }).where(whereLink(p));
      await notify(otherId, { type: "club_link", title: `${me?.name} hat die Verknüpfung bestätigt`, href: "/dashboard/verknuepfungen", actorId: user.id });
      return { status: "accepted" as const };
    }
    if (existing) {
      await db.update(clubLinks).set({ status: "pending", initiatedBy: user.id, createdAt: new Date() }).where(whereLink(p));
    } else {
      await db.insert(clubLinks).values({ ...p, status: "pending", initiatedBy: user.id });
    }
    await notify(otherId, {
      type: "club_link",
      title: user.accountType === "club" ? `${me?.name} lädt dich ins Line-up ein` : `${me?.name} möchte sich mit deinem Betrieb verknüpfen`,
      href: "/dashboard/verknuepfungen",
      actorId: user.id,
    });
    revalidatePath("/dashboard/verknuepfungen");
    return { status: "pending" as const };
  });
}

/** Annehmen oder ablehnen (nur die eingeladene Seite). */
export async function respondLink(otherId: string, accept: boolean) {
  return run(async () => {
    const user = await gate();
    z.uuid().parse(otherId);
    await writeLimit(user.id, "link-respond");
    const p = pair(user, otherId);
    const [l] = await db.select().from(clubLinks).where(whereLink(p));
    if (!l || l.status !== "pending" || l.initiatedBy === user.id) throw new ApiError("NOT_FOUND", "Keine offene Anfrage");
    if (accept) {
      await db.update(clubLinks).set({ status: "accepted" }).where(whereLink(p));
      const me = await getSummary(user.id, user);
      await notify(otherId, { type: "club_link", title: `${me?.name} hat die Verknüpfung bestätigt`, href: "/dashboard/verknuepfungen", actorId: user.id });
    } else {
      await db.update(clubLinks).set({ status: "rejected", presentOn: null }).where(whereLink(p));
    }
    revalidatePath("/dashboard/verknuepfungen");
    return { status: accept ? ("accepted" as const) : ("rejected" as const) };
  });
}

/** Verknüpfung oder Anfrage entfernen (beide Seiten). */
export async function removeLink(otherId: string) {
  return run(async () => {
    const user = await gate();
    z.uuid().parse(otherId);
    await writeLimit(user.id, "link-remove");
    await db.delete(clubLinks).where(whereLink(pair(user, otherId)));
    revalidatePath("/dashboard/verknuepfungen");
    return { removed: true };
  });
}

/** Club markiert ein verknüpftes Girl als "heute anwesend". */
export async function setPresentToday(escortId: string, present: boolean) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["club"] });
    z.uuid().parse(escortId);
    z.boolean().parse(present);
    await writeLimit(user.id, "link-present", 120);
    const res = await db
      .update(clubLinks)
      .set({ presentOn: present ? zurichToday() : null })
      .where(and(eq(clubLinks.clubId, user.id), eq(clubLinks.escortId, escortId), eq(clubLinks.status, "accepted")))
      .returning({ id: clubLinks.escortId });
    if (!res.length) throw new ApiError("NOT_FOUND", "Keine bestätigte Verknüpfung");
    return { present };
  });
}
