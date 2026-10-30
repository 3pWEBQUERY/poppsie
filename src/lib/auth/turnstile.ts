import "server-only";
import { env } from "@/lib/env";

/** Cloudflare Turnstile prüfen. Ohne Secret (lokal) wird die Prüfung übersprungen. */
export async function verifyTurnstile(token: string | null | undefined, ip?: string) {
  if (!env.turnstileSecret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.turnstileSecret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success;
  } catch {
    return false;
  }
}
