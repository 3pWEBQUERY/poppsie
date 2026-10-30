import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function hmac(input: string) {
  return createHmac("sha256", env.secret).update(input).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** 6-stelliger Code, gespeichert wird nur SHA-256(salt + code). */
export function generateCode() {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomToken(16);
  return { code, salt, hash: sha256(salt + code) };
}

export function verifyCode(code: string, salt: string, hash: string) {
  return safeEqual(sha256(salt + code), hash);
}

const key = () => createHash("sha256").update(`enc:${env.secret}`).digest();

/** AES-256-GCM, Ergebnis: base64url(iv | tag | ciphertext). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decrypt(payload: string) {
  const buf = Buffer.from(payload, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
