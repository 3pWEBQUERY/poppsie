"use server";

import { resolveMx } from "node:dns/promises";
import { cookies } from "next/headers";
import { and, eq, gt, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clubProfiles, escortProfiles, pendingRegistrations, users } from "@/db/schema";
import { generateCode, randomToken, sha256, verifyCode as checkCode } from "@/lib/auth/crypto";
import { ApiError, run } from "@/lib/auth/guards";
import { hashPassword, pwnedCount } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { passwordStrength } from "@/lib/auth/strength";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { emailSchema, isDisposable, PASSWORD_MIN, RESERVED_USERNAMES, usernameSchema } from "@/lib/auth/validation";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { activationMail, noticeMail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { limitOrThrow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { slugify } from "@/lib/utils";

const REG_COOKIE = "pp_reg";
const CODE_TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_SENDS_PER_HOUR = 5;

async function currentPending() {
  const token = (await cookies()).get(REG_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db.select().from(pendingRegistrations).where(eq(pendingRegistrations.tokenHash, sha256(token)));
  return row ?? null;
}

async function requirePending() {
  const p = await currentPending();
  if (!p) throw new ApiError("INVALID", "Deine Registrierung ist abgelaufen. Bitte beginne erneut.");
  return p;
}

/** Live-Prüfung (debounced im Client). */
export async function checkUsername(raw: string) {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) return { available: false, reason: parsed.error.issues[0]?.message ?? "Ungültig" };
  const name = parsed.data;
  if (RESERVED_USERNAMES.has(name) || [...RESERVED_USERNAMES].some((r) => r.length > 4 && name.includes(r))) {
    return { available: false, reason: "Dieser Name ist reserviert" };
  }
  if (!(await limitOrThrow(`uname:${await clientIp()}`, 120, 60).then(() => true).catch(() => false))) {
    return { available: false, reason: "Zu viele Anfragen" };
  }
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, name));
  if (taken) return { available: false, reason: "Dieser Benutzername ist bereits vergeben" };
  const mine = await currentPending();
  const [reserved] = await db
    .select({ id: pendingRegistrations.id })
    .from(pendingRegistrations)
    .where(
      and(
        eq(pendingRegistrations.username, name),
        gt(pendingRegistrations.createdAt, new Date(Date.now() - 2 * 3600_000)),
        mine ? ne(pendingRegistrations.id, mine.id) : undefined,
      ),
    );
  if (reserved) return { available: false, reason: "Dieser Benutzername ist bereits vergeben" };
  return { available: true, reason: null };
}

/** Schritt 1: Benutzername. Legt den serverseitigen Zwischenstand (pending_registration) an. */
export async function saveUsername(raw: string, accountType?: string) {
  return run(async () => {
    const ip = await clientIp();
    await limitOrThrow(`reg:${ip}`, 20, 3600, "Zu viele Registrierungsversuche von deiner Verbindung.");
    const check = await checkUsername(raw);
    if (!check.available) throw new ApiError("INVALID", check.reason ?? "Ungültig");
    const username = usernameSchema.parse(raw);
    const type = z.enum(["member", "escort", "club"]).safeParse(accountType);
    const existing = await currentPending();
    if (existing) {
      await db.update(pendingRegistrations).set({ username }).where(eq(pendingRegistrations.id, existing.id));
      return { username };
    }
    const token = randomToken(24);
    await db.insert(pendingRegistrations).values({
      tokenHash: sha256(token),
      username,
      ip,
      locale: await getLocale(),
      accountType: type.success ? type.data : null,
    });
    (await cookies()).set(REG_COOKIE, token, { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", maxAge: 2 * 3600 });
    return { username };
  });
}

async function hasMx(domain: string) {
  try {
    const mx = await resolveMx(domain);
    return mx.length > 0;
  } catch (e) {
    // Ohne DNS (z. B. lokal offline) nicht blockieren
    return (e as NodeJS.ErrnoException).code !== "ENOTFOUND" && (e as NodeJS.ErrnoException).code !== "ENODATA";
  }
}

/** Schritt 2: E-Mail – Format, MX-Record, Wegwerf-Blockliste. Bestehende Accounts werden nicht verraten. */
export async function saveEmail(raw: string) {
  return run(async () => {
    const p = await requirePending();
    const email = emailSchema.parse(raw);
    if (isDisposable(email)) throw new ApiError("INVALID", "Bitte verwende keine Wegwerf-Adresse");
    if (!(await hasMx(email.split("@")[1]!))) throw new ApiError("INVALID", "Diese E-Mail-Domain kann keine E-Mails empfangen");
    await limitOrThrow(`reg-email:${email}`, 10, 3600);
    await db.update(pendingRegistrations).set({ email }).where(eq(pendingRegistrations.id, p.id));
    return { email };
  });
}

/** Schritt 3: Kontotyp (bei Club/Studio direkt mit Club-Typ). */
export async function saveAccountType(type: string, clubType?: string | null) {
  return run(async () => {
    const p = await requirePending();
    const t = z.enum(["member", "escort", "club"]).parse(type);
    const ct = t === "club" ? z.enum(["club", "studio", "laufhaus", "kontaktbar", "saunaclub", "nachtclub"]).parse(clubType) : null;
    await db.update(pendingRegistrations).set({ accountType: t, clubType: ct }).where(eq(pendingRegistrations.id, p.id));
    return { type: t };
  });
}

/** Schritt 4: Passwort (min. 10, zxcvbn, HIBP), AGB + 18+, Bot-Schutz. Danach wird der Code versendet. */
export async function savePassword(input: { password: string; confirm: string; terms: boolean; adult: boolean; turnstile?: string | null }) {
  return run(async () => {
    const p = await requirePending();
    if (!p.username || !p.email || !p.accountType) throw new ApiError("INVALID", "Bitte fülle zuerst die vorherigen Schritte aus");
    if (input.password.length < PASSWORD_MIN) throw new ApiError("INVALID", `Mindestens ${PASSWORD_MIN} Zeichen`);
    if (input.password.length > 200) throw new ApiError("INVALID", "Passwort ist zu lang");
    if (input.password !== input.confirm) throw new ApiError("INVALID", "Die Passwörter stimmen nicht überein");
    if (!input.terms) throw new ApiError("INVALID", "Bitte akzeptiere AGB und Datenschutz");
    if (!input.adult) throw new ApiError("INVALID", "Du musst mindestens 18 Jahre alt sein");
    const ip = await clientIp();
    if (!(await verifyTurnstile(input.turnstile, ip))) throw new ApiError("INVALID", "Bot-Schutz fehlgeschlagen. Bitte versuche es erneut.");
    const strength = await passwordStrength(input.password, [p.username, p.email]);
    if (strength.score < 2) throw new ApiError("INVALID", strength.warning || "Dieses Passwort ist zu leicht zu erraten");
    const pwned = await pwnedCount(input.password);
    if (pwned > 0) throw new ApiError("INVALID", `Dieses Passwort ist in ${pwned.toLocaleString("de-CH")} bekannten Datenlecks aufgetaucht. Bitte wähle ein anderes.`);
    const passwordHash = await hashPassword(input.password);
    const now = new Date();
    await db.update(pendingRegistrations).set({ passwordHash, termsAcceptedAt: now, ageConfirmedAt: now }).where(eq(pendingRegistrations.id, p.id));
    await sendCode({ ...p, passwordHash }, true);
    return { sent: true };
  });
}

/** Code (neu) senden: frühestens nach 60 s, max. 5 pro Stunde. Gespeichert wird nur der Hash. */
async function sendCode(p: typeof pendingRegistrations.$inferSelect, first = false) {
  const now = Date.now();
  if (!first && p.lastSentAt && now - p.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ApiError("RATE_LIMITED", "Bitte warte 60 Sekunden, bevor du einen neuen Code anforderst");
  }
  const windowStart = p.sendWindowStart && now - p.sendWindowStart.getTime() < 3600_000 ? p.sendWindowStart : new Date(now);
  const sendCount = windowStart === p.sendWindowStart ? p.sendCount + 1 : 1;
  if (sendCount > MAX_SENDS_PER_HOUR) throw new ApiError("RATE_LIMITED", "Maximal 5 Codes pro Stunde. Bitte versuche es später erneut.");

  const { code, salt, hash } = generateCode();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, p.email!));
  await db
    .update(pendingRegistrations)
    .set({
      // Für bereits registrierte E-Mails wird ein unbrauchbarer Hash gespeichert (keine Enumeration).
      codeHash: existing ? sha256(randomToken()) : hash,
      codeSalt: salt,
      codeExpiresAt: new Date(now + CODE_TTL_MS),
      attempts: 0,
      lastSentAt: new Date(now),
      sendWindowStart: windowStart,
      sendCount,
    })
    .where(eq(pendingRegistrations.id, p.id));
  const locale = (p.locale as "de" | "fr" | "it" | "en") ?? "de";
  if (existing) {
    await sendMail(
      p.email!,
      noticeMail("Du hast bereits ein Konto", "Jemand wollte sich mit deiner E-Mail-Adresse neu registrieren. Falls du das warst: melde dich einfach an oder setze dein Passwort zurück.", `${env.appUrl}/anmelden`),
    );
  } else {
    await sendMail(p.email!, activationMail(locale, code));
  }
}

export async function resendCode() {
  return run(async () => {
    const p = await requirePending();
    if (!p.passwordHash || !p.email) throw new ApiError("INVALID", "Bitte schliesse zuerst die vorherigen Schritte ab");
    await sendCode(p);
    return { sent: true };
  });
}

/** Schritt 5: Code bestätigen → Account aktiv, Session setzen, weiter zum Dashboard. */
export async function confirmCode(code: string) {
  return run(async () => {
    const p = await requirePending();
    if (!/^\d{6}$/.test(code)) throw new ApiError("INVALID", "Bitte gib den 6-stelligen Code ein");
    if (!p.codeHash || !p.codeSalt || !p.codeExpiresAt) throw new ApiError("INVALID", "Bitte fordere einen Code an");
    if (p.attempts >= MAX_ATTEMPTS) throw new ApiError("INVALID", "Zu viele Fehlversuche. Bitte fordere einen neuen Code an.");
    if (p.codeExpiresAt.getTime() < Date.now()) throw new ApiError("INVALID", "Der Code ist abgelaufen. Bitte fordere einen neuen an.");
    if (!checkCode(code, p.codeSalt, p.codeHash)) {
      await db.update(pendingRegistrations).set({ attempts: p.attempts + 1 }).where(eq(pendingRegistrations.id, p.id));
      const left = MAX_ATTEMPTS - p.attempts - 1;
      throw new ApiError("INVALID", left > 0 ? `Falscher Code. Noch ${left} Versuch${left === 1 ? "" : "e"}.` : "Zu viele Fehlversuche. Bitte fordere einen neuen Code an.");
    }
    if (!p.username || !p.email || !p.passwordHash || !p.accountType) throw new ApiError("INVALID", "Registrierung unvollständig");

    const userId = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          username: p.username!,
          email: p.email!,
          passwordHash: p.passwordHash!,
          accountType: p.accountType!,
          status: "active",
          locale: p.locale,
          country: "CH",
          role: env.adminUsername && p.username === env.adminUsername ? "admin" : "user",
          // Escorts und Clubs: verification_pending bis das KYC abgeschlossen ist
          kycStatus: p.accountType === "member" ? "none" : "pending",
        })
        .returning({ id: users.id });
      if (p.accountType === "escort") await tx.insert(escortProfiles).values({ userId: u!.id, displayName: p.username });
      if (p.accountType === "club") {
        await tx.insert(clubProfiles).values({ userId: u!.id, clubType: p.clubType ?? "club", slug: `${slugify(p.username!)}-${u!.id.slice(0, 4)}`, name: null });
      }
      await tx.delete(pendingRegistrations).where(eq(pendingRegistrations.id, p.id));
      return u!.id;
    });
    (await cookies()).delete(REG_COOKIE);
    await createSession(userId);
    return { redirect: "/dashboard?willkommen=1" };
  });
}

/** Für den Wizard: Zwischenstand laden (z. B. nach Reload). */
export async function loadRegistration() {
  const p = await currentPending();
  if (!p) return null;
  return {
    username: p.username,
    email: p.email,
    accountType: p.accountType,
    clubType: p.clubType,
    hasPassword: Boolean(p.passwordHash),
    codeSent: Boolean(p.codeHash),
    lastSentAt: p.lastSentAt?.toISOString() ?? null,
  };
}
