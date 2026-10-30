"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moderationFlags, users } from "@/db/schema";
import { requireUser, run } from "@/lib/auth/guards";
import { notifyMany } from "@/lib/notify";
import { limitOrThrow } from "@/lib/rate-limit";

const Input = z.object({
  targetType: z.enum(["profile", "post", "comment", "review", "message", "story", "group", "thread", "media"]),
  targetId: z.uuid(),
  targetUserId: z.uuid().optional(),
  reason: z.enum(["minor", "coercion", "trafficking", "spam", "abuse", "fake", "privacy", "illegal", "other"]),
  details: z.string().max(2000).optional(),
});

const URGENT = new Set(["minor", "coercion", "trafficking"]);

/**
 * Meldung erstellen. Verdacht auf Minderjährigkeit, Zwang oder Menschenhandel wird mit höchster
 * Priorität eskaliert und das betroffene Profil sofort vorläufig ausgeblendet.
 */
export async function createFlag(input: z.input<typeof Input>) {
  return run(async () => {
    const user = await requireUser();
    const data = Input.parse(input);
    await limitOrThrow(`flag:${user.id}`, 20, 3600);
    const urgent = URGENT.has(data.reason);
    await db.insert(moderationFlags).values({
      reporterId: user.id,
      targetType: data.targetType,
      targetId: data.targetId,
      targetUserId: data.targetUserId ?? (data.targetType === "profile" ? data.targetId : null),
      reason: data.reason,
      details: data.details,
      priority: urgent ? 100 : data.reason === "illegal" ? 50 : 10,
    });
    const hideId = data.targetUserId ?? (data.targetType === "profile" ? data.targetId : null);
    if (urgent && hideId) {
      await db.update(users).set({ profileHidden: true }).where(and(eq(users.id, hideId), eq(users.role, "user")));
      const staff = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      await notifyMany(
        staff.map((s) => s.id),
        { type: "moderation.urgent", title: "Dringende Meldung", body: "Verdacht auf Minderjährigkeit, Zwang oder Menschenhandel", href: "/admin" },
      );
    }
    return { urgent };
  });
}
