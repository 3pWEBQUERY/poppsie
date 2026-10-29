"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clubProfiles, escortProfiles, media, users } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { writeLimit } from "@/lib/rate-limit";
import { loadDraft, loadOwnMedia, profileStatus } from "./draft";
import { deleteMediaRows, ownProfileMedia } from "./media";
import { saveStep } from "./save";
import type { StepKey } from "./steps";

/*
 * Profil-Wizard, Profil-Editor und Galerie bleiben auch bei unvollständigem Profil erlaubt
 * (requireUser() ohne complete).
 */

const STEP_KEYS = ["basics", "appearance", "location", "about", "services", "media", "hours", "details"] as const;

export async function loadProfileDraft() {
  return run(async () => {
    const user = await requireUser();
    return loadDraft(user);
  });
}

export async function saveProfileStep(step: StepKey, data: unknown) {
  return run(async () => {
    const user = await requireUser();
    const key = z.enum(STEP_KEYS).parse(step);
    await writeLimit(user.id, "profile-step", 120);
    const res = await saveStep(user, key, data);
    if (res.saved) revalidatePath("/dashboard", "layout");
    return res;
  });
}

const provider = () => requireUser({ types: ["escort", "club"] });

export async function deleteProfileMedia(ids: string[]) {
  return run(async () => {
    const user = await requireUser();
    const list = z.array(z.uuid()).min(1).max(50).parse(ids);
    await writeLimit(user.id, "media-delete");
    const own = await ownProfileMedia(user.id, list);
    const n = await deleteMediaRows(
      user.id,
      own.map((m) => m.id),
    );
    revalidatePath("/dashboard/galerie");
    return { deleted: n, status: await profileStatus(user.id) };
  });
}

export async function reorderGallery(ids: string[]) {
  return run(async () => {
    const user = await provider();
    const list = z.array(z.uuid()).max(50).parse(ids);
    await writeLimit(user.id, "media-order", 120);
    await db.transaction(async (tx) => {
      for (const [i, id] of list.entries()) {
        await tx
          .update(media)
          .set({ sortOrder: i })
          .where(and(eq(media.id, id), eq(media.ownerId, user.id), eq(media.purpose, "gallery")));
      }
    });
    return { ok: true };
  });
}

export async function setMediaBlur(id: string, blur: boolean) {
  return run(async () => {
    const user = await requireUser();
    z.uuid().parse(id);
    await writeLimit(user.id, "media-blur", 120);
    const res = await db
      .update(media)
      .set({ blurForGuests: z.boolean().parse(blur) })
      .where(and(eq(media.id, id), eq(media.ownerId, user.id)))
      .returning({ id: media.id });
    if (!res.length) throw new ApiError("NOT_FOUND");
    return { blur };
  });
}

/** Globaler Schalter "Für Gäste unkenntlich machen"; mit applyAll für alle Profilmedien. */
export async function setGlobalBlur(blur: boolean, applyAll: boolean) {
  return run(async () => {
    const user = await provider();
    z.boolean().parse(blur);
    await writeLimit(user.id, "media-blur", 120);
    if (user.accountType === "escort") {
      await db.update(escortProfiles).set({ blurForGuests: blur, updatedAt: new Date() }).where(eq(escortProfiles.userId, user.id));
    } else {
      await db.update(clubProfiles).set({ blurForGuests: blur, updatedAt: new Date() }).where(eq(clubProfiles.userId, user.id));
    }
    if (applyAll) {
      await db
        .update(media)
        .set({ blurForGuests: blur })
        .where(and(eq(media.ownerId, user.id), inArray(media.purpose, ["gallery", "avatar", "cover", "logo"])));
    }
    revalidatePath("/dashboard/galerie");
    return loadOwnMedia(user.id);
  });
}

/** Galeriebild als Profilbild oder Titelbild verwenden. */
export async function assignMediaSlot(id: string, slot: "avatar" | "cover") {
  return run(async () => {
    const user = await requireUser();
    z.uuid().parse(id);
    z.enum(["avatar", "cover"]).parse(slot);
    await writeLimit(user.id, "media-slot");
    const [m] = await ownProfileMedia(user.id, [id]);
    if (!m || m.kind !== "image") throw new ApiError("INVALID", "Nur Bilder können verwendet werden");
    const [u] = await db.select({ avatar: users.avatarMediaId, cover: users.coverMediaId }).from(users).where(eq(users.id, user.id));
    const previous = slot === "avatar" ? u?.avatar : u?.cover;
    await db
      .update(users)
      .set(slot === "avatar" ? { avatarMediaId: id, updatedAt: new Date() } : { coverMediaId: id, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    if (slot === "avatar" && user.accountType === "club") await db.update(clubProfiles).set({ logoMediaId: id }).where(eq(clubProfiles.userId, user.id));
    if (previous && previous !== id) {
      const [old] = await db.select({ purpose: media.purpose }).from(media).where(eq(media.id, previous));
      if (old && old.purpose !== "gallery") await deleteMediaRows(user.id, [previous]);
    }
    revalidatePath("/dashboard", "layout");
    return { status: await profileStatus(user.id) };
  });
}
