import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubTypeSchemas, users } from "@/db/schema";
import { DEFAULT_CLUB_SCHEMAS } from "@/lib/profile/club-schemas";
import { seedForum } from "@/db/seed-forum";

/** Idempotente Start-Aufgaben: Referenzdaten anlegen, Admin-Rolle vergeben. */
export async function bootstrap() {
  for (const s of DEFAULT_CLUB_SCHEMAS) {
    await db.insert(clubTypeSchemas).values(s).onConflictDoNothing();
  }
  await seedForum();
  const admin = process.env.ADMIN_USERNAME;
  if (admin) await db.update(users).set({ role: "admin" }).where(eq(users.username, admin.toLowerCase()));
  await db.execute(sql`DELETE FROM pending_registrations WHERE created_at < now() - interval '1 day'`);
}
