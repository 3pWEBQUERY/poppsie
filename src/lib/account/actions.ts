"use server";

import { cookies } from "next/headers";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appeals, moderationActions, notifications, sessions, users } from "@/db/schema";
import { decrypt, encrypt, sha256 } from "@/lib/auth/crypto";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { hashPassword, pwnedCount, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, destroyAllSessions } from "@/lib/auth/session";
import { passwordStrength } from "@/lib/auth/strength";
import { PASSWORD_MIN, emailSchema, isDisposable } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { APPEALABLE } from "@/lib/admin/labels";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n/config";
import { sendMail } from "@/lib/mail/send";
import { noticeMail } from "@/lib/mail/templates";
import { limitOrThrow, writeLimit } from "@/lib/rate-limit";
import { DELETION_AUDIT_ACTION } from "./restore";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

async function checkPassword(userId: string, password: string) {
  await limitOrThrow(`pw-check:${userId}`, 10, 900, "Zu viele Versuche. Bitte warte 15 Minuten.");
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!u || !(await verifyPassword(u.hash, password))) throw new ApiError("INVALID", "Das aktuelle Passwort ist falsch");
}

export async function changeEmail(input: { email: string; password: string }) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.email", 5, 3600);
    const parsed = emailSchema.safeParse(input.email);
    if (!parsed.success) throw new ApiError("INVALID", parsed.error.issues[0]?.message ?? "Ungültige E-Mail");
    const email = parsed.data;
    if (email === user.email) throw new ApiError("INVALID", "Das ist bereits deine E-Mail-Adresse");
    if (isDisposable(email)) throw new ApiError("INVALID", "Wegwerf-Adressen sind nicht erlaubt");
    await checkPassword(user.id, input.password);
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (taken) throw new ApiError("CONFLICT", "Diese E-Mail-Adresse wird bereits verwendet");
    await db.update(users).set({ email, updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(user.id, "account.email_changed", { type: "user", id: user.id }, { from: user.email, to: email });
    try {
      await sendMail(
        user.email,
        noticeMail("Deine E-Mail-Adresse wurde geändert", `Die E-Mail-Adresse deines Poppsie-Kontos wurde geändert. Warst du das nicht? Setze sofort dein Passwort zurück und melde dich bei support@poppsie.ch.`),
      );
      await sendMail(email, noticeMail("Neue E-Mail-Adresse bestätigt", "Diese Adresse ist ab sofort mit deinem Poppsie-Konto verknüpft."));
    } catch (err) {
      console.error("[account] Mail fehlgeschlagen", err);
    }
    return { email };
  });
}

export async function changePassword(input: { current: string; password: string; confirm: string }) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.password", 5, 3600);
    if (input.password.length < PASSWORD_MIN) throw new ApiError("INVALID", `Mindestens ${PASSWORD_MIN} Zeichen`);
    if (input.password.length > 200) throw new ApiError("INVALID", "Höchstens 200 Zeichen");
    if (input.password !== input.confirm) throw new ApiError("INVALID", "Die Passwörter stimmen nicht überein");
    await checkPassword(user.id, input.current);
    if (input.current === input.password) throw new ApiError("INVALID", "Das neue Passwort muss sich vom alten unterscheiden");
    const strength = await passwordStrength(input.password, [user.username, user.email]);
    if (strength.score < 2) throw new ApiError("INVALID", strength.warning || "Dieses Passwort ist zu leicht zu erraten");
    if ((await pwnedCount(input.password)) > 0) throw new ApiError("INVALID", "Dieses Passwort ist in bekannten Datenlecks aufgetaucht. Bitte wähle ein anderes.");
    await db.update(users).set({ passwordHash: await hashPassword(input.password), updatedAt: new Date() }).where(eq(users.id, user.id));
    // Andere Geräte abmelden, aktuelle Sitzung behalten
    const current = await currentSessionId();
    await db.delete(sessions).where(current ? and(eq(sessions.userId, user.id), ne(sessions.id, current)) : eq(sessions.userId, user.id));
    await audit(user.id, "account.password_changed", { type: "user", id: user.id });
    try {
      await sendMail(user.email, noticeMail("Dein Passwort wurde geändert", "Das Passwort deines Poppsie-Kontos wurde geändert und andere Geräte wurden abgemeldet. Warst du das nicht? Setze sofort dein Passwort zurück."));
    } catch (err) {
      console.error("[account] Mail fehlgeschlagen", err);
    }
    return { ok: true };
  });
}

const Prefs = z.object({
  locale: z.enum(LOCALES),
  timezone: z.string().min(3).max(64),
});

export async function updatePreferences(input: z.input<typeof Prefs>) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.prefs", 20, 60);
    const d = Prefs.parse(input);
    if (!Intl.supportedValuesOf("timeZone").includes(d.timezone) && d.timezone !== "UTC") throw new ApiError("INVALID", "Unbekannte Zeitzone");
    await db.update(users).set({ locale: d.locale, timezone: d.timezone, updatedAt: new Date() }).where(eq(users.id, user.id));
    (await cookies()).set(LOCALE_COOKIE, d.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return d;
  });
}

/** 2FA einrichten, Schritt 1: Secret erzeugen. Es wird erst nach Code-Bestätigung gespeichert (verschlüsseltes Token im Client). */
export async function startTotp() {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.totp", 10, 600);
    if (user.totpSecret) throw new ApiError("CONFLICT", "Die Zwei-Faktor-Anmeldung ist bereits aktiv");
    const secret = generateTotpSecret();
    const token = encrypt(JSON.stringify({ s: secret, u: user.id, e: Date.now() + 15 * 60_000 }));
    return { secret, uri: otpauthUri(secret, user.username), token };
  });
}

export async function enableTotp(input: { token: string; code: string }) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.totp", 10, 600);
    let payload: { s: string; u: string; e: number };
    try {
      payload = JSON.parse(decrypt(input.token));
    } catch {
      throw new ApiError("INVALID", "Die Einrichtung ist abgelaufen. Bitte starte neu.");
    }
    if (payload.u !== user.id || payload.e < Date.now()) throw new ApiError("INVALID", "Die Einrichtung ist abgelaufen. Bitte starte neu.");
    if (!verifyTotp(payload.s, input.code)) throw new ApiError("INVALID", "Der Code stimmt nicht. Prüfe die Uhrzeit deines Geräts und versuche es erneut.");
    await db.update(users).set({ totpSecret: encrypt(payload.s), updatedAt: new Date() }).where(and(eq(users.id, user.id), isNull(users.totpSecret)));
    await audit(user.id, "account.totp_enabled", { type: "user", id: user.id });
    return { ok: true };
  });
}

export async function disableTotp(input: { password: string; code: string }) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.totp", 10, 600);
    if (!user.totpSecret) throw new ApiError("CONFLICT", "Die Zwei-Faktor-Anmeldung ist nicht aktiv");
    await checkPassword(user.id, input.password);
    let ok = false;
    try {
      ok = verifyTotp(decrypt(user.totpSecret), input.code);
    } catch {}
    if (!ok) throw new ApiError("INVALID", "Der Code stimmt nicht");
    await db.update(users).set({ totpSecret: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(user.id, "account.totp_disabled", { type: "user", id: user.id });
    return { ok: true };
  });
}

export async function revokeSession(sessionId: string) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.sessions", 30, 60);
    if (sessionId === (await currentSessionId())) throw new ApiError("INVALID", "Die aktuelle Sitzung beendest du über «Abmelden»");
    await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
    await audit(user.id, "account.session_revoked", { type: "user", id: user.id });
    return { ok: true };
  });
}

export async function revokeOtherSessions() {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.sessions", 30, 60);
    const current = await currentSessionId();
    const removed = await db
      .delete(sessions)
      .where(current ? and(eq(sessions.userId, user.id), ne(sessions.id, current)) : eq(sessions.userId, user.id))
      .returning({ id: sessions.id });
    await audit(user.id, "account.sessions_revoked", { type: "user", id: user.id }, { count: removed.length });
    return { count: removed.length };
  });
}

export async function submitAppeal(input: { actionId: string; body: string }) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.appeal", 5, 3600);
    const actionId = z.uuid().parse(input.actionId);
    const body = input.body.trim();
    if (body.length < 20) throw new ApiError("INVALID", "Bitte begründe deinen Einspruch (mindestens 20 Zeichen)");
    if (body.length > 3000) throw new ApiError("INVALID", "Höchstens 3000 Zeichen");
    const [a] = await db.select().from(moderationActions).where(and(eq(moderationActions.id, actionId), eq(moderationActions.targetUserId, user.id)));
    if (!a) throw new ApiError("NOT_FOUND", "Entscheid nicht gefunden");
    if (!APPEALABLE.has(a.action)) throw new ApiError("INVALID", "Gegen diesen Entscheid ist kein Einspruch möglich");
    if (Date.now() - a.createdAt.getTime() > 90 * 86400_000) throw new ApiError("INVALID", "Die Einspruchsfrist von 90 Tagen ist abgelaufen");
    const [existing] = await db.select({ id: appeals.id }).from(appeals).where(eq(appeals.actionId, actionId));
    if (existing) throw new ApiError("CONFLICT", "Du hast gegen diesen Entscheid bereits Einspruch erhoben");
    const [row] = await db.insert(appeals).values({ actionId, userId: user.id, body }).returning({ id: appeals.id });
    await audit(user.id, "account.appeal_submitted", { type: "appeal", id: row!.id }, { actionId });
    return { id: row!.id };
  });
}

/** Konto löschen: 30 Tage Frist, Profil sofort ausgeblendet, alle Sitzungen beendet. */
export async function requestDeletion(input: { password: string }) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "account.delete", 5, 3600);
    await checkPassword(user.id, input.password);
    const now = new Date();
    await db.update(users).set({ deletionRequestedAt: now, profileHidden: true, updatedAt: now }).where(eq(users.id, user.id));
    await audit(user.id, DELETION_AUDIT_ACTION, { type: "user", id: user.id }, { profileWasHidden: user.profileHidden });
    try {
      await sendMail(
        user.email,
        noticeMail(
          "Dein Konto wird gelöscht",
          "Wir haben deinen Löschauftrag erhalten. Dein Profil ist ab sofort unsichtbar. Nach 30 Tagen werden alle persönlichen Daten endgültig entfernt; Berichte bleiben anonymisiert erhalten. Du hast es dir anders überlegt? Melde dich innerhalb von 30 Tagen einfach wieder an.",
        ),
      );
    } catch (err) {
      console.error("[account] Mail fehlgeschlagen", err);
    }
    await destroyAllSessions(user.id);
    (await cookies()).delete(SESSION_COOKIE);
    return { redirect: "/" };
  });
}

export async function markNotificationRead(id: string) {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "notifications.read", 120, 60);
    const nid = z.uuid().parse(id);
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, nid), eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return { ok: true };
  });
}

export async function markAllNotificationsRead() {
  return run(async () => {
    const user = await requireUser();
    await writeLimit(user.id, "notifications.read", 120, 60);
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return { count: rows.length };
  });
}
