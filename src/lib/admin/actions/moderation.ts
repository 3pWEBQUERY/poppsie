"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appeals, moderationActions, moderationFlags } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { writeLimit } from "@/lib/rate-limit";
import { applyModeration, dismissFlag, informUser, revertAction } from "../moderate";

const STAFF = { roles: ["admin", "moderator"] as ("admin" | "moderator")[] };

const ModerateInput = z.object({
  action: z.enum(["warn", "remove_content", "suspend_temp", "suspend_perm", "unsuspend", "hide_profile", "restore_profile"]),
  reason: z.string().trim().min(5, "Bitte gib eine Begründung an (mindestens 5 Zeichen)").max(2000),
  flagId: z.uuid().optional(),
  userId: z.uuid().optional(),
  days: z.number().int().min(1).max(365).optional(),
  threadMode: z.enum(["lock", "delete"]).optional(),
});

export async function moderate(input: z.input<typeof ModerateInput>) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.moderate", 120);
    const parsed = ModerateInput.safeParse(input);
    if (!parsed.success) throw new ApiError("INVALID", parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
    const res = await applyModeration(staff, parsed.data);
    revalidatePath("/admin", "layout");
    return res;
  });
}

const DismissInput = z.object({
  flagId: z.uuid(),
  reason: z.string().trim().min(5, "Bitte gib eine Begründung an (mindestens 5 Zeichen)").max(2000),
  restoreProfile: z.boolean().optional(),
});

export async function dismiss(input: z.input<typeof DismissInput>) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.moderate", 120);
    const parsed = DismissInput.safeParse(input);
    if (!parsed.success) throw new ApiError("INVALID", parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
    const res = await dismissFlag(staff, parsed.data);
    revalidatePath("/admin", "layout");
    return res;
  });
}

/** Meldung übernehmen (Status «In Prüfung»), damit niemand parallel daran arbeitet. */
export async function claimFlag(flagId: string) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.claim", 120);
    const id = z.uuid().parse(flagId);
    const [row] = await db
      .update(moderationFlags)
      .set({ status: "in_review", resolvedBy: staff.id })
      .where(and(eq(moderationFlags.id, id), eq(moderationFlags.status, "open")))
      .returning({ id: moderationFlags.id });
    if (!row) throw new ApiError("CONFLICT", "Die Meldung ist nicht mehr offen");
    await audit(staff.id, "moderation.claim", { type: "flag", id });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

/** Meldung wieder öffnen (z. B. versehentlich verworfen). */
export async function reopenFlag(flagId: string) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.claim", 120);
    const id = z.uuid().parse(flagId);
    await db.update(moderationFlags).set({ status: "open", resolvedBy: null, resolvedAt: null, resolution: null }).where(eq(moderationFlags.id, id));
    await audit(staff.id, "moderation.reopen", { type: "flag", id });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

const AppealDecision = z.object({
  appealId: z.uuid(),
  decision: z.enum(["accepted", "rejected"]),
  note: z.string().trim().min(5, "Bitte begründe den Entscheid (mindestens 5 Zeichen)").max(2000),
  revert: z.boolean().optional(),
});

export async function decideAppeal(input: z.input<typeof AppealDecision>) {
  return run(async () => {
    const staff = await requireUser(STAFF);
    await writeLimit(staff.id, "admin.appeal", 60);
    const parsed = AppealDecision.safeParse(input);
    if (!parsed.success) throw new ApiError("INVALID", parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
    const d = parsed.data;
    const [ap] = await db
      .select({ appeal: appeals, moderatorId: moderationActions.moderatorId })
      .from(appeals)
      .innerJoin(moderationActions, eq(moderationActions.id, appeals.actionId))
      .where(eq(appeals.id, d.appealId));
    if (!ap) throw new ApiError("NOT_FOUND", "Einspruch nicht gefunden");
    if (ap.appeal.status !== "open") throw new ApiError("CONFLICT", "Der Einspruch wurde bereits entschieden");
    if (ap.moderatorId === staff.id && staff.role !== "admin") {
      throw new ApiError("FORBIDDEN", "Einsprüche gegen eigene Entscheide prüft eine andere Person");
    }
    await db.update(appeals).set({ status: d.decision, decidedBy: staff.id }).where(eq(appeals.id, d.appealId));
    const revert = d.decision === "accepted" && d.revert !== false ? await revertAction(ap.appeal.actionId) : null;
    await audit(staff.id, `appeal.${d.decision}`, { type: "appeal", id: d.appealId }, { note: d.note, actionId: ap.appeal.actionId, revert });
    await informUser(
      ap.appeal.userId,
      d.decision === "accepted" ? "Dein Einspruch wurde angenommen" : "Dein Einspruch wurde abgelehnt",
      `${d.note}${revert?.reverted ? `\n\n${revert.note}.` : ""}`,
    );
    revalidatePath("/admin", "layout");
    return { revert };
  });
}
