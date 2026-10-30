import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, media, users } from "@/db/schema";
import { deleteObject } from "@/lib/storage";

type MediaRow = typeof media.$inferSelect;

/** Löscht Medien inkl. aller Speicherobjekte und entfernt Verweise (Avatar, Cover, Logo). */
export async function deleteMediaRows(ownerId: string, ids: string[]) {
  if (!ids.length) return 0;
  const rows: MediaRow[] = await db
    .select()
    .from(media)
    .where(and(eq(media.ownerId, ownerId), inArray(media.id, ids)));
  if (!rows.length) return 0;
  const found = rows.map((r) => r.id);
  const [u] = await db.select({ avatar: users.avatarMediaId, cover: users.coverMediaId }).from(users).where(eq(users.id, ownerId));
  const patch: Partial<typeof users.$inferInsert> = {};
  if (u?.avatar && found.includes(u.avatar)) patch.avatarMediaId = null;
  if (u?.cover && found.includes(u.cover)) patch.coverMediaId = null;
  if (Object.keys(patch).length) await db.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, ownerId));
  await db
    .update(clubProfiles)
    .set({ logoMediaId: null })
    .where(and(eq(clubProfiles.userId, ownerId), inArray(clubProfiles.logoMediaId, found)));
  await db.delete(media).where(and(eq(media.ownerId, ownerId), inArray(media.id, found)));
  const keys = rows.flatMap((r) => [r.storageKey, r.thumbKey, r.blurKey]).filter(Boolean) as string[];
  await Promise.all(
    [...new Set(keys)].map((k) =>
      deleteObject(k).catch((e) => {
        console.error("deleteObject fehlgeschlagen", k, e);
      }),
    ),
  );
  return found.length;
}

/** Eigene Medien mit diesen IDs (nur Profil-Zwecke). */
export async function ownProfileMedia(ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  return db
    .select()
    .from(media)
    .where(
      and(
        eq(media.ownerId, ownerId),
        inArray(media.id, ids),
        or(eq(media.purpose, "gallery"), eq(media.purpose, "avatar"), eq(media.purpose, "cover"), eq(media.purpose, "logo")),
      ),
    );
}
