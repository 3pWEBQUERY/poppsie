import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { createHash } from "node:crypto";

// Argon2id (Algorithm.Argon2id = 2), OWASP-Empfehlung: m=19 MiB, t=2, p=1
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Have I Been Pwned (k-Anonymity): nur die ersten 5 Zeichen des SHA-1 verlassen den Server.
 * Gibt die Anzahl der Treffer zurück; bei Netzwerkfehlern 0 (fail open).
 */
export async function pwnedCount(password: string): Promise<number> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 0;
    const text = await res.text();
    for (const line of text.split("\n")) {
      const [s, count] = line.trim().split(":");
      if (s === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
