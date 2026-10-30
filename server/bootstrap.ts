import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, getPool } from "@/db";
import { clubTypeSchemas, users } from "@/db/schema";
import { DEFAULT_CLUB_SCHEMAS } from "@/lib/profile/club-schemas";
import { seedForum } from "@/db/seed-forum";
import { seedCommunity } from "@/db/seed/community";
import { seedDemo } from "@/db/seed/demo";
import { randomToken } from "@/lib/auth/crypto";

/** Idempotente Start-Aufgaben: Referenzdaten anlegen, Admin-Rolle vergeben. */
export async function bootstrap() {
  // Migrationen beim Start (idempotent); Advisory-Lock verhindert parallele Läufe mehrerer Instanzen.
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('poppsie:migrate'))");
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.query("SELECT pg_advisory_unlock(hashtext('poppsie:migrate'))");
  } finally {
    client.release();
  }
  for (const s of DEFAULT_CLUB_SCHEMAS) {
    await db.insert(clubTypeSchemas).values(s).onConflictDoNothing();
  }
  await seedForum();
  const admin = process.env.ADMIN_USERNAME;
  if (admin) await db.update(users).set({ role: "admin" }).where(eq(users.username, admin.toLowerCase()));
  await db.execute(sql`DELETE FROM pending_registrations WHERE created_at < now() - interval '1 day'`);

  // Testprofile für Test-Umgebungen (idempotent). Der Demo-User "admin" bekommt hier keine Admin-Rolle
  // und ein Zufallspasswort, damit über ein bekanntes Passwort niemand Moderationsrechte erhält.
  if (process.env.SEED_DEMO === "1") {
    await seedDemo({ password: process.env.DEMO_PASSWORD ?? "poppsie-demo-2026", adminPassword: randomToken(24), adminRole: "user" });
    const created = await seedCommunity();
    console.log(`> Demo-Daten geprüft${created ? " und Community-Inhalte angelegt" : ""}`);
  }
}
