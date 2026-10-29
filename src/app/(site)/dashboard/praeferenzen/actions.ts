"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ApiError, run } from "@/lib/auth/guards";
import { cleanCriteria, CriteriaSchema, criteriaCount, type CriteriaInput } from "@/lib/matching/criteria";
import { deleteCriteria, storeCriteria } from "@/lib/matching/store";
import { writeLimit } from "@/lib/rate-limit";

/** Präferenzen speichern (verschlüsselt). Nur für Mitglieder mit vollständigem Profil. */
export async function savePreferences(input: CriteriaInput) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["member"] });
    await writeLimit(user.id, "preferences", 30, 60);
    const parsed = CriteriaSchema.safeParse(input);
    if (!parsed.success) throw new ApiError("INVALID", "Ungültige Angaben");
    const criteria = cleanCriteria(parsed.data);
    await storeCriteria(user.id, criteria);
    revalidatePath("/dashboard/matches");
    revalidatePath("/dashboard/praeferenzen");
    return criteriaCount(criteria);
  });
}

export async function resetPreferences() {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["member"] });
    await writeLimit(user.id, "preferences", 30, 60);
    await deleteCriteria(user.id);
    revalidatePath("/dashboard/matches");
    revalidatePath("/dashboard/praeferenzen");
  });
}
