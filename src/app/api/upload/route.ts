import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { media } from "@/db/schema";
import { ApiError, errorResponse, requireUser } from "@/lib/auth/guards";
import { AUDIO_TYPES, extFromMime, FILE_TYPES, IMAGE_TYPES, LIMITS, processImage, storeRaw, VIDEO_TYPES } from "@/lib/media/process";
import { scanUpload } from "@/lib/media/scan";
import { mediaUrl } from "@/lib/media/urls";
import { limitOrThrow } from "@/lib/rate-limit";

const Fields = z.object({
  purpose: z.enum(["gallery", "avatar", "cover", "logo", "post", "message", "story", "comment", "group"]),
  blurForGuests: z.enum(["true", "false"]).optional(),
  durationSec: z.coerce.number().int().min(0).max(3600).optional(),
});

/** Profil-Medien sind auch vor Abschluss des Profils erlaubt (der Wizard braucht sie). */
const PROFILE_PURPOSES = new Set(["gallery", "avatar", "cover", "logo"]);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const fields = Fields.parse({
      purpose: form.get("purpose"),
      blurForGuests: form.get("blurForGuests") ?? undefined,
      durationSec: form.get("durationSec") ?? undefined,
    });
    const user = await requireUser({ complete: !PROFILE_PURPOSES.has(fields.purpose) });
    await limitOrThrow(`upload:${user.id}`, 60, 600, "Zu viele Uploads. Bitte warte ein paar Minuten.");

    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("INVALID", "Keine Datei");
    const mime = file.type;
    const buf = Buffer.from(await file.arrayBuffer());

    if (fields.purpose === "gallery") {
      const [{ n }] = await db.select({ n: count() }).from(media).where(and(eq(media.ownerId, user.id), eq(media.purpose, "gallery")));
      if (n >= LIMITS.galleryItems) throw new ApiError("INVALID", `Maximal ${LIMITS.galleryItems} Medien in der Galerie`);
    }

    let row: typeof media.$inferInsert;
    const blurForGuests = fields.blurForGuests === "true";
    if (IMAGE_TYPES.includes(mime)) {
      if (buf.length > LIMITS.imageBytes) throw new ApiError("INVALID", "Bild ist zu gross (max. 25 MB)");
      const img = await processImage(buf, user.id);
      row = { ownerId: user.id, kind: "image", purpose: fields.purpose, mime: "image/webp", blurForGuests, fileName: file.name.slice(0, 120), ...img };
    } else if (VIDEO_TYPES.includes(mime)) {
      if (buf.length > LIMITS.videoBytes) throw new ApiError("INVALID", "Video ist zu gross (max. 100 MB)");
      const max = fields.purpose === "story" ? LIMITS.storyVideoSec : fields.purpose === "gallery" ? LIMITS.galleryVideoSec : 3600;
      if ((fields.durationSec ?? 0) > max) throw new ApiError("INVALID", `Video darf höchstens ${max} Sekunden lang sein`);
      const raw = await storeRaw(buf, user.id, extFromMime(mime), mime);
      row = { ownerId: user.id, kind: "video", purpose: fields.purpose, mime, blurForGuests, durationSec: fields.durationSec, fileName: file.name.slice(0, 120), ...raw };
    } else if (AUDIO_TYPES.includes(mime.split(";")[0]!) && fields.purpose === "message") {
      const base = mime.split(";")[0]!;
      const raw = await storeRaw(buf, user.id, extFromMime(base), base);
      row = { ownerId: user.id, kind: "audio", purpose: "message", mime: base, durationSec: fields.durationSec, ...raw };
    } else if (FILE_TYPES.includes(mime) && fields.purpose === "message") {
      if (buf.length > LIMITS.fileBytes) throw new ApiError("INVALID", "Datei ist zu gross (max. 25 MB)");
      const raw = await storeRaw(buf, user.id, "pdf", mime);
      row = { ownerId: user.id, kind: "file", purpose: "message", mime, fileName: file.name.slice(0, 120), ...raw };
    } else {
      throw new ApiError("INVALID", "Dateityp nicht erlaubt");
    }

    const [created] = await db.insert(media).values(row).returning();
    const scan = await scanUpload({ mediaId: created!.id, ownerId: user.id, sha256: created!.sha256 ?? "", mime });
    if (scan.rejected) {
      await db.update(media).set({ status: "rejected" }).where(eq(media.id, created!.id));
      throw new ApiError("INVALID", "Upload wurde abgelehnt");
    }
    return Response.json({
      id: created!.id,
      kind: created!.kind,
      width: created!.width,
      height: created!.height,
      fileName: created!.fileName,
      thumbUrl: mediaUrl(created!.id, created!.kind === "image" ? "t" : "o"),
      url: mediaUrl(created!.id, "o"),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ code: "INVALID", error: "Ungültige Angaben" }, { status: 422 });
    return errorResponse(err);
  }
}
