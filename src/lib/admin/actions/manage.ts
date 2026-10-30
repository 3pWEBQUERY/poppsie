"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { escortProfiles, kycVerifications, moderationActions, users } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { writeLimit } from "@/lib/rate-limit";
import { ageFrom } from "../labels";
import { informUser } from "../moderate";

const KycInput = z.object({
  userId: z.uuid(),
  decision: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(2000).default(""),
});

/** KYC-Entscheid: alle offenen Nachweise der Person, users.kycStatus, Mitteilung + E-Mail. */
export async function decideKyc(input: z.input<typeof KycInput>) {
  return run(async () => {
    const staff = await requireUser({ roles: ["admin", "moderator"] });
    await writeLimit(staff.id, "admin.kyc", 60);
    const parsed = KycInput.safeParse(input);
    if (!parsed.success) throw new ApiError("INVALID", parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
    const d = parsed.data;
    if (d.decision === "rejected" && d.note.length < 5) throw new ApiError("INVALID", "Bitte begründe die Ablehnung (mindestens 5 Zeichen)");
    const [target] = await db.select().from(users).where(eq(users.id, d.userId));
    if (!target || (target.accountType !== "escort" && target.accountType !== "club")) throw new ApiError("NOT_FOUND", "Konto nicht gefunden");
    if (target.id === staff.id) throw new ApiError("FORBIDDEN", "Eigene Verifikationen prüft eine andere Person");
    if (d.decision === "verified" && target.accountType === "escort") {
      // Mindestalter 18 hart geprüft: ohne bestätigtes Geburtsdatum keine Freischaltung
      const [p] = await db.select({ birthDate: escortProfiles.birthDate }).from(escortProfiles).where(eq(escortProfiles.userId, target.id));
      const age = ageFrom(p?.birthDate);
      if (age === null) throw new ApiError("INVALID", "Kein Geburtsdatum im Profil – Alter kann nicht bestätigt werden");
      if (age < 18) throw new ApiError("FORBIDDEN", "Die Person ist laut Geburtsdatum unter 18 und darf nicht freigeschaltet werden");
    }
    const now = new Date();
    await db
      .update(kycVerifications)
      .set({ status: d.decision, note: d.note || null, decidedBy: staff.id, decidedAt: now })
      .where(and(eq(kycVerifications.userId, d.userId), eq(kycVerifications.status, "pending")));
    await db.update(users).set({ kycStatus: d.decision, updatedAt: now }).where(eq(users.id, d.userId));
    const action = d.decision === "verified" ? "kyc_approve" : "kyc_reject";
    const [row] = await db
      .insert(moderationActions)
      .values({ moderatorId: staff.id, targetUserId: d.userId, action, reason: d.note || "Identität und Alter bestätigt" })
      .returning({ id: moderationActions.id });
    await audit(staff.id, `kyc.${d.decision}`, { type: "user", id: d.userId }, { note: d.note, actionId: row!.id });
    await informUser(
      d.userId,
      d.decision === "verified" ? "Deine Verifikation wurde bestätigt" : "Deine Verifikation wurde abgelehnt",
      d.decision === "verified"
        ? `Deine Identität und dein Alter sind bestätigt. Dein Profil trägt jetzt das Verifiziert-Badge.${d.note ? `\n\n${d.note}` : ""}`
        : `${d.note}\n\nDu kannst die Verifikation jederzeit erneut starten.`,
      { href: "/dashboard/verifikation" },
    );
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

const RoleInput = z.object({ userId: z.uuid(), role: z.enum(["user", "moderator", "admin"]) });

/** Rollenverwaltung (nur Admins). Der letzte Admin kann nicht herabgestuft werden. */
export async function setRole(input: z.input<typeof RoleInput>) {
  return run(async () => {
    const admin = await requireUser({ roles: ["admin"] });
    await writeLimit(admin.id, "admin.role", 30);
    const d = RoleInput.parse(input);
    const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, d.userId));
    if (!target) throw new ApiError("NOT_FOUND", "Benutzer nicht gefunden");
    if (target.role === d.role) return { ok: true };
    if (target.role === "admin" && d.role !== "admin") {
      const [others] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), ne(users.id, target.id)));
      if (!others?.n) throw new ApiError("CONFLICT", "Es muss mindestens ein Admin bestehen bleiben");
    }
    await db.update(users).set({ role: d.role, updatedAt: new Date() }).where(eq(users.id, d.userId));
    await audit(admin.id, "user.role", { type: "user", id: d.userId }, { from: target.role, to: d.role });
    revalidatePath(`/admin/benutzer/${d.userId}`);
    return { ok: true };
  });
}
