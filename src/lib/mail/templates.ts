import type { Locale } from "@/lib/i18n/config";

type Mail = { subject: string; text: string; html: string };

const wrap = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1b1d20">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px">
<tr><td style="background:#141619;color:#ffffff;padding:16px 24px;font-weight:bold;font-size:18px;border-radius:8px 8px 0 0">Poppsie</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${title}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#71717a;border-top:1px solid #e4e4e7">Poppsie · 18+ · Diese E-Mail wurde automatisch versendet.</td></tr>
</table></td></tr></table></body></html>`;

const codeBlock = (code: string) =>
  `<div style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f4f4f5;border-radius:6px;padding:16px;text-align:center;margin:16px 0">${code}</div>`;

const ACTIVATION: Record<Locale, { subject: string; title: string; intro: string; valid: string; ignore: string }> = {
  de: {
    subject: "Dein Aktivierungscode",
    title: "Willkommen bei Poppsie",
    intro: "Gib diesen Code ein, um dein Konto zu aktivieren:",
    valid: "Der Code ist 15 Minuten gültig.",
    ignore: "Du hast dich nicht registriert? Dann ignoriere diese E-Mail.",
  },
  fr: {
    subject: "Ton code d'activation",
    title: "Bienvenue sur Poppsie",
    intro: "Saisis ce code pour activer ton compte :",
    valid: "Le code est valable 15 minutes.",
    ignore: "Tu ne t'es pas inscrit·e ? Ignore simplement cet e-mail.",
  },
  it: {
    subject: "Il tuo codice di attivazione",
    title: "Benvenuto su Poppsie",
    intro: "Inserisci questo codice per attivare il tuo account:",
    valid: "Il codice è valido per 15 minuti.",
    ignore: "Non ti sei registrato? Ignora questa e-mail.",
  },
  en: {
    subject: "Your activation code",
    title: "Welcome to Poppsie",
    intro: "Enter this code to activate your account:",
    valid: "The code is valid for 15 minutes.",
    ignore: "Didn't sign up? Just ignore this email.",
  },
};

export function activationMail(locale: Locale, code: string): Mail {
  const m = ACTIVATION[locale] ?? ACTIVATION.de;
  return {
    subject: `${m.subject}: ${code}`,
    text: `${m.title}\n\n${m.intro}\n\n${code}\n\n${m.valid}\n${m.ignore}`,
    html: wrap(m.title, `<p>${m.intro}</p>${codeBlock(code)}<p>${m.valid}</p><p style="color:#71717a">${m.ignore}</p>`),
  };
}

const RESET: Record<Locale, { subject: string; intro: string; button: string; valid: string }> = {
  de: { subject: "Passwort zurücksetzen", intro: "Klicke auf den Link, um ein neues Passwort zu setzen:", button: "Neues Passwort setzen", valid: "Der Link ist 60 Minuten gültig." },
  fr: { subject: "Réinitialiser le mot de passe", intro: "Clique sur le lien pour définir un nouveau mot de passe :", button: "Nouveau mot de passe", valid: "Le lien est valable 60 minutes." },
  it: { subject: "Reimposta la password", intro: "Clicca sul link per impostare una nuova password:", button: "Nuova password", valid: "Il link è valido per 60 minuti." },
  en: { subject: "Reset your password", intro: "Click the link to set a new password:", button: "Set new password", valid: "The link is valid for 60 minutes." },
};

export function resetMail(locale: Locale, url: string): Mail {
  const m = RESET[locale] ?? RESET.de;
  return {
    subject: m.subject,
    text: `${m.intro}\n${url}\n\n${m.valid}`,
    html: wrap(
      m.subject,
      `<p>${m.intro}</p><p><a href="${url}" style="display:inline-block;background:#d1202f;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${m.button}</a></p><p>${m.valid}</p>`,
    ),
  };
}

export function noticeMail(title: string, body: string, url?: string): Mail {
  return {
    subject: title,
    text: `${body}${url ? `\n\n${url}` : ""}`,
    html: wrap(title, `<p>${body}</p>${url ? `<p><a href="${url}">${url}</a></p>` : ""}`),
  };
}
