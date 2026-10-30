/**
 * Erzeugt eine Session für einen Benutzer und gibt das Cookie-Token aus (nur Entwicklung).
 * Aufruf: npx tsx scripts/dev-session.ts sophia.fire   →   Cookie: pp_session=<token>
 */
import "../server/env";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/auth/crypto";

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error("Benutzername fehlt");
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (!u) throw new Error(`Benutzer ${username} nicht gefunden`);
  const token = randomToken(32);
  await db.insert(sessions).values({ id: sha256(token), userId: u.id, expiresAt: new Date(Date.now() + 7 * 86400_000) });
  console.log(token);
  process.exit(0);
}

main();
