"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users, visibilityBlocks } from "@/db/schema";
import { requireUser, run } from "@/lib/auth/guards";
import { ALL_COUNTRIES } from "@/lib/geo/countries";
import { writeLimit } from "@/lib/rate-limit";

const Privacy = z.object({
  profileHidden: z.boolean().optional(),
  incognito: z.boolean().optional(),
  showOnline: z.boolean().optional(),
  readReceipts: z.boolean().optional(),
});

/** Hauptschalter und Privatsphäre-Optionen. */
export async function updatePrivacy(input: z.input<typeof Privacy>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const patch = Privacy.parse(input);
    await writeLimit(user.id, "privacy");
    if (Object.keys(patch).length) await db.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, user.id));
    revalidatePath("/dashboard/sichtbarkeit");
    return patch;
  });
}

/** Länder sperren oder freigeben (einzeln oder "Alle sperren / Alle freigeben" eines Kontinents). */
export async function setCountryBlocks(codes: string[], blocked: boolean) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const list = z
      .array(z.string().refine((c) => ALL_COUNTRIES.includes(c)))
      .min(1)
      .max(ALL_COUNTRIES.length)
      .parse(codes);
    z.boolean().parse(blocked);
    await writeLimit(user.id, "country-block", 120);
    if (blocked) {
      await db
        .insert(visibilityBlocks)
        .values(list.map((countryCode) => ({ userId: user.id, countryCode })))
        .onConflictDoNothing();
    } else {
      await db.delete(visibilityBlocks).where(and(eq(visibilityBlocks.userId, user.id), inArray(visibilityBlocks.countryCode, list)));
    }
    const rows = await db.select({ c: visibilityBlocks.countryCode }).from(visibilityBlocks).where(eq(visibilityBlocks.userId, user.id));
    return { blocked: rows.map((r) => r.c) };
  });
}
