import "server-only";
import { headers } from "next/headers";

export async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "0.0.0.0";
}

/**
 * Herkunftsland des Besuchers: Cloudflare CF-IPCountry (wenn die Domain über Cloudflare läuft),
 * sonst x-vercel-ip-country / x-country. Zusätzlich gilt immer das Land eingeloggter User.
 */
export async function requestCountry(): Promise<string | null> {
  const h = await headers();
  const c = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? h.get("x-country");
  if (!c || c === "XX" || c === "T1") return null;
  return c.toUpperCase();
}

const BOT_RE = /bot|crawl|spider|slurp|bing|facebookexternalhit|preview|headless|lighthouse|python-requests|curl|wget/i;

export async function isBot() {
  const ua = (await headers()).get("user-agent") ?? "";
  return !ua || BOT_RE.test(ua);
}
