import { hmac, safeEqual } from "@/lib/auth/crypto";

export type MediaVariant = "o" | "t" | "b";

/**
 * Signierte, ablaufende Medien-URL. Gäste erhalten bei aktivem Blur ausschliesslich die Variante "b";
 * die Route /api/media prüft Signatur, Ablauf und Berechtigung erneut.
 */
export function mediaUrl(id: string, variant: MediaVariant = "t", ttlSec = 3600) {
  // Auf 10 Minuten runden, damit Browser-Caches greifen.
  const exp = Math.ceil((Date.now() / 1000 + ttlSec) / 600) * 600;
  const sig = hmac(`${id}.${variant}.${exp}`).slice(0, 22);
  return `/api/media/${id}/${variant}?e=${exp}&s=${sig}`;
}

export function verifyMediaSig(id: string, variant: string, exp: string | null, sig: string | null) {
  if (!exp || !sig) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  return safeEqual(hmac(`${id}.${variant}.${exp}`).slice(0, 22), sig);
}

/** Variante, die ein Betrachter sehen darf. */
export function variantFor(opts: { blurForGuests: boolean; isGuest: boolean; wanted: MediaVariant }): MediaVariant {
  if (opts.isGuest && opts.blurForGuests) return "b";
  return opts.wanted;
}
