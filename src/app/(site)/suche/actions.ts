"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { savedSearches } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { writeLimit } from "@/lib/rate-limit";
import { parseFilters, toQueryRecord } from "@/lib/search/filters";

const MAX_SAVED = 50;

const Input = z.object({
  name: z.string().trim().min(1).max(80),
  notify: z.boolean(),
  query: z.record(z.string(), z.string().max(2000)),
});

/** "Suche speichern": Name + Benachrichtigung bei neuen Treffern. */
export async function saveSearch(input: z.input<typeof Input>) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const parsed = Input.safeParse(input);
    if (!parsed.success) throw new ApiError("INVALID", "Bitte gib einen Namen (max. 80 Zeichen) ein");
    await writeLimit(user.id, "saved-search", 20, 60);
    const [row] = await db.select({ n: count() }).from(savedSearches).where(eq(savedSearches.userId, user.id));
    if ((row?.n ?? 0) >= MAX_SAVED) throw new ApiError("CONFLICT", `Du kannst höchstens ${MAX_SAVED} Suchen speichern`);
    // Über den Parser normalisieren: nur bekannte, gültige Parameter landen in der Datenbank.
    const query = toQueryRecord(parseFilters(new URLSearchParams(parsed.data.query)));
    const [saved] = await db
      .insert(savedSearches)
      .values({ userId: user.id, name: parsed.data.name, notify: parsed.data.notify, query, lastCheckedAt: new Date() })
      .returning({ id: savedSearches.id });
    revalidatePath("/dashboard/suchen");
    return { id: saved!.id };
  });
}
