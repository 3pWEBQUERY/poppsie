import { z } from "zod";

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

/** Reservierte Namen (System, Rollen, Marken). */
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "support", "hilfe", "help", "moderator", "mod", "team", "staff", "system", "poppsie", "official",
  "offiziell", "info", "kontakt", "contact", "security", "sicherheit", "abuse", "legal", "privacy", "datenschutz", "impressum", "api",
  "www", "mail", "noreply", "no-reply", "billing", "presse", "press", "dashboard", "settings", "login", "logout", "register",
  "registrieren", "anmelden", "escort", "escorts", "club", "clubs", "forum", "feed", "gruppen", "groups", "suche", "search",
  "joyclub", "kaufmich", "onlyfans", "instagram", "tiktok", "google", "apple",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, "3–20 Zeichen: a–z, 0–9, Punkt und Unterstrich");

export const emailSchema = z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein").max(200);

/** Bekannte Wegwerf-Domains (erweiterbar über DISPOSABLE_DOMAINS, kommagetrennt). */
const DISPOSABLE = new Set([
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "guerrillamail.de", "sharklasers.com", "tempmail.com", "temp-mail.org",
  "trashmail.com", "trashmail.de", "yopmail.com", "yopmail.fr", "getnada.com", "dispostable.com", "maildrop.cc", "throwawaymail.com",
  "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com", "tempinbox.com", "spamgourmet.com", "mytemp.email", "tempr.email",
  "discard.email", "wegwerfmail.de", "wegwerfmail.net", "einrot.com", "spambog.com", "byom.de", "mailnesia.com", "moakt.com",
  "burnermail.io", "tmail.ws", "tempmailo.com", "1secmail.com", "inboxkitten.com", "emailfake.com", "mail.tm", "minuteinbox.com",
]);

export function isDisposable(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const extra = (process.env.DISPOSABLE_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return DISPOSABLE.has(domain) || extra.includes(domain);
}

export const PASSWORD_MIN = 10;
