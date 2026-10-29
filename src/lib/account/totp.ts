import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "@/lib/auth/crypto";

/**
 * TOTP nach RFC 6238 (HMAC-SHA1, 30-Sekunden-Schritte, 6 Stellen) mit Base32-Secret (RFC 4648).
 * Kompatibel mit gängigen Authenticator-Apps.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Ungültiges Base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-Bit-Secret, wie von RFC 4226 empfohlen. */
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226) für einen Zähler. */
export function hotp(secret: string, counter: number) {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(msg).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const bin = ((h[offset]! & 0x7f) << 24) | (h[offset + 1]! << 16) | (h[offset + 2]! << 8) | h[offset + 3]!;
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totp(secret: string, at = Date.now()) {
  return hotp(secret, Math.floor(at / 1000 / STEP));
}

/** Prüft einen Code mit ±1 Zeitschritt Toleranz (Uhrabweichung). */
export function verifyTotp(secret: string, code: string, at = Date.now(), window = 1) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const counter = Math.floor(at / 1000 / STEP);
  let ok = false;
  for (let i = -window; i <= window; i++) {
    if (safeEqual(hotp(secret, counter + i), c)) ok = true;
  }
  return ok;
}

export function otpauthUri(secret: string, account: string, issuer = "Poppsie") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}
