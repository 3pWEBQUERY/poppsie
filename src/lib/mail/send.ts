import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = env.resendKey ? new Resend(env.resendKey) : null;

/** Versand über Resend. Ohne API-Key (lokal) wird die Mail im Server-Log ausgegeben. */
export async function sendMail(to: string, mail: { subject: string; text: string; html: string }) {
  if (!resend) {
    console.log(`\n[mail] an ${to}: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const { error } = await resend.emails.send({ from: env.mailFrom, to, subject: mail.subject, text: mail.text, html: mail.html });
  if (error) {
    console.error("[mail] Resend-Fehler", error);
    throw new Error("E-Mail konnte nicht gesendet werden");
  }
}
