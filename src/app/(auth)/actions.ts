"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { checkStoredTotp, restoreAfterDeletionRequest } from "@/lib/account/restore";
import { ApiError, run, type ActionResult } from "@/lib/auth/guards";
import { hashPassword, pwnedCount, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyAllSessions, destroySession } from "@/lib/auth/session";
import { passwordStrength } from "@/lib/auth/strength";
import { PASSWORD_MIN } from "@/lib/auth/validation";
import { env } from "@/lib/env";
import { resetMail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { limitOrThrow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

// Zum Ausgleich der Laufzeit, wenn der Benutzer nicht existiert (Timing-Enumeration)
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(randomToken(16)));

export type LoginResult = ActionResult<{ redirect: string }> | { ok: false; code: "TOTP_REQUIRED"; status: 401; error: string };

/** Login. Mit aktivierter 2FA ohne (gültigen) Code: Fehlercode TOTP_REQUIRED, das Formular zeigt das Code-Feld. */
export async function login(input: { identifier: string; password: string; otp?: string; next?: string | null }): Promise<LoginResult> {
  const res = await run(async () => {
    const ip = await clientIp();
    const id = input.identifier.trim().toLowerCase();
    await limitOrThrow(`login-ip:${ip}`, 30, 900, "Zu viele Anmeldeversuche. Bitte warte 15 Minuten.");
    await limitOrThrow(`login-id:${id}`, 10, 900, "Zu viele Anmeldeversuche für dieses Konto. Bitte warte 15 Minuten.");
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, id), eq(users.email, id)));
    const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), input.password);
    if (!user || !ok) throw new ApiError("INVALID", "Benutzername oder Passwort ist falsch");
    if (user.status === "deleted") throw new ApiError("INVALID", "Benutzername oder Passwort ist falsch");
    if (user.status === "suspended" && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
      throw new ApiError("FORBIDDEN", user.suspendedUntil ? `Dein Konto ist gesperrt bis ${user.suspendedUntil.toLocaleDateString("de-CH")}.` : "Dein Konto ist gesperrt.");
    }
    if (user.totpSecret) {
      const otp = input.otp?.replace(/\s/g, "") ?? "";
      if (!otp) return { totp: "missing" as const };
      if (!checkStoredTotp(user.totpSecret, otp)) return { totp: "invalid" as const };
    }
    if (user.deletionRequestedAt) {
      // Anmeldung innerhalb der Löschfrist stellt das Konto wieder her
      await restoreAfterDeletionRequest(user.id);
    }
    if (env.adminUsername && user.username === env.adminUsername && user.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    }
    await createSession(user.id);
    const next = input.next && input.next.startsWith("/") && !input.next.startsWith("//") ? input.next : "/dashboard";
    return { redirect: next };
  });
  if (res.ok && "totp" in res.data) {
    return {
      ok: false,
      code: "TOTP_REQUIRED",
      status: 401,
      error: res.data.totp === "invalid" ? "Der Code ist ungültig. Bitte versuche es erneut." : "Bitte gib den Code aus deiner Authenticator-App ein.",
    };
  }
  return res as ActionResult<{ redirect: string }>;
}

export async function logout() {
  await destroySession();
  redirect("/");
}

/** Neutrale Antwort, unabhängig davon, ob die E-Mail existiert. */
export async function requestPasswordReset(email: string) {
  return run(async () => {
    const e = email.trim().toLowerCase();
    await limitOrThrow(`reset-ip:${await clientIp()}`, 10, 3600);
    await limitOrThrow(`reset:${e}`, 3, 3600);
    const [user] = await db.select().from(users).where(eq(users.email, e));
    if (user && user.status !== "deleted") {
      const token = randomToken(32);
      await db.insert(passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) });
      await sendMail(user.email, resetMail((user.locale as "de") ?? "de", `${env.appUrl}/passwort-zuruecksetzen?token=${token}`));
    }
    return { sent: true };
  });
}

export async function resetPassword(input: { token: string; password: string; confirm: string }) {
  return run(async () => {
    if (input.password.length < PASSWORD_MIN) throw new ApiError("INVALID", `Mindestens ${PASSWORD_MIN} Zeichen`);
    if (input.password !== input.confirm) throw new ApiError("INVALID", "Die Passwörter stimmen nicht überein");
    const [row] = await db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.tokenHash, sha256(input.token)), gt(passwordResets.expiresAt, new Date()), isNull(passwordResets.usedAt)));
    if (!row) throw new ApiError("INVALID", "Der Link ist ungültig oder abgelaufen");
    const strength = await passwordStrength(input.password);
    if (strength.score < 2) throw new ApiError("INVALID", strength.warning || "Dieses Passwort ist zu leicht zu erraten");
    if ((await pwnedCount(input.password)) > 0) throw new ApiError("INVALID", "Dieses Passwort ist in bekannten Datenlecks aufgetaucht");
    await db.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, row.userId));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id));
    await destroyAllSessions(row.userId);
    await createSession(row.userId);
    return { redirect: "/dashboard" };
  });
}
