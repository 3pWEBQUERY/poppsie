"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { kycVerifications, media, users } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { IMAGE_TYPES, LIMITS, processImage } from "@/lib/media/process";
import { scanUpload } from "@/lib/media/scan";
import { limitOrThrow } from "@/lib/rate-limit";
import { kycProvider, randomGestureCode } from "./kyc";
import { deleteMediaRows } from "./media";

/* Verifikation ist auch bei unvollständigem Profil erlaubt (requireUser ohne complete). */
const provider = () => requireUser({ types: ["escort", "club"] });

async function latest(userId: string, kind: "identity" | "photo") {
  const [row] = await db
    .select()
    .from(kycVerifications)
    .where(and(eq(kycVerifications.userId, userId), eq(kycVerifications.kind, kind)))
    .orderBy(desc(kycVerifications.createdAt))
    .limit(1);
  return row ?? null;
}

/** Identitätsprüfung starten (Ausweis + Selfie-Abgleich beim KYC-Anbieter). */
export async function startIdentityVerification() {
  return run(async () => {
    const user = await provider();
    await limitOrThrow(`kyc-start:${user.id}`, 5, 86400, "Zu viele Versuche. Bitte versuche es morgen erneut.");
    if (user.kycStatus === "verified") throw new ApiError("CONFLICT", "Deine Identität ist bereits verifiziert");
    const open = await latest(user.id, "identity");
    if (open?.status === "pending") return { id: open.id, redirectUrl: null };
    const p = kycProvider();
    const [row] = await db
      .insert(kycVerifications)
      .values({ userId: user.id, kind: "identity", provider: p.id, status: "pending" })
      .returning();
    const res = await p.start({ userId: user.id, verificationId: row!.id });
    if (res.providerRef) await db.update(kycVerifications).set({ providerRef: res.providerRef }).where(eq(kycVerifications.id, row!.id));
    await db.update(users).set({ kycStatus: "pending", updatedAt: new Date() }).where(eq(users.id, user.id));
    revalidatePath("/dashboard", "layout");
    return { id: row!.id, redirectUrl: res.redirectUrl };
  });
}

/** Foto-Verifikation: neuen Gesten-Code erzeugen (ersetzt einen offenen Vorgang ohne Selfie). */
export async function startPhotoVerification() {
  return run(async () => {
    const user = await provider();
    await limitOrThrow(`kyc-photo:${user.id}`, 10, 86400, "Zu viele Versuche. Bitte versuche es morgen erneut.");
    const open = await latest(user.id, "photo");
    if (open?.status === "verified") throw new ApiError("CONFLICT", "Deine Fotos sind bereits verifiziert");
    if (open?.status === "pending" && !open.providerRef) {
      const gestureCode = randomGestureCode();
      await db.update(kycVerifications).set({ gestureCode }).where(eq(kycVerifications.id, open.id));
      return { id: open.id, gestureCode };
    }
    if (open?.status === "pending" && open.providerRef) throw new ApiError("CONFLICT", "Dein Selfie wird bereits geprüft");
    const gestureCode = randomGestureCode();
    const [row] = await db.insert(kycVerifications).values({ userId: user.id, kind: "photo", provider: "manual", gestureCode, status: "pending" }).returning();
    revalidatePath("/dashboard/verifikation");
    return { id: row!.id, gestureCode };
  });
}

/**
 * Selfie hochladen. Gespeichert als Medium mit purpose "message", damit es nie öffentlich
 * ausgeliefert wird; das Moderationsteam prüft es in der Warteschlange.
 */
export async function submitVerificationSelfie(form: FormData) {
  return run(async () => {
    const user = await provider();
    await limitOrThrow(`kyc-selfie:${user.id}`, 10, 86400, "Zu viele Uploads. Bitte versuche es morgen erneut.");
    const id = z.uuid().parse(form.get("verificationId"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("INVALID", "Keine Datei");
    if (!IMAGE_TYPES.includes(file.type)) throw new ApiError("INVALID", "Bitte lade ein Foto hoch (JPG, PNG, WebP, HEIC)");
    if (file.size > LIMITS.imageBytes) throw new ApiError("INVALID", "Bild ist zu gross (max. 25 MB)");
    const [v] = await db
      .select()
      .from(kycVerifications)
      .where(and(eq(kycVerifications.id, id), eq(kycVerifications.userId, user.id), eq(kycVerifications.kind, "photo")));
    if (!v || v.status !== "pending") throw new ApiError("NOT_FOUND", "Kein offener Vorgang");
    if (v.providerRef) throw new ApiError("CONFLICT", "Selfie wurde bereits hochgeladen");

    const img = await processImage(Buffer.from(await file.arrayBuffer()), user.id);
    const [m] = await db
      .insert(media)
      .values({ ownerId: user.id, kind: "image", purpose: "message", mime: "image/webp", fileName: "verifikation.webp", ...img })
      .returning();
    const scan = await scanUpload({ mediaId: m!.id, ownerId: user.id, sha256: m!.sha256 ?? "", mime: "image/webp" });
    if (scan.rejected) {
      await deleteMediaRows(user.id, [m!.id]);
      throw new ApiError("INVALID", "Upload wurde abgelehnt");
    }
    await db.update(kycVerifications).set({ providerRef: m!.id, note: null }).where(eq(kycVerifications.id, v.id));
    revalidatePath("/dashboard/verifikation");
    return { ok: true };
  });
}
