import "server-only";
import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { putObject } from "@/lib/storage";

export const LIMITS = {
  imageBytes: 25 * 1024 * 1024,
  videoBytes: 100 * 1024 * 1024,
  fileBytes: 25 * 1024 * 1024,
  galleryItems: 50,
  galleryVideoSec: 60,
  storyVideoSec: 30,
};

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"];
export const FILE_TYPES = ["application/pdf"];

export type ProcessedImage = {
  storageKey: string;
  thumbKey: string;
  blurKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
};

/**
 * Bildpipeline: Rotation nach EXIF, danach werden alle Metadaten (EXIF/GPS) verworfen
 * (sharp übernimmt Metadaten nur mit withMetadata()). Varianten:
 * - original: max. 2560 px, WebP
 * - thumb: 640 px, WebP
 * - blur: serverseitig Gauss-Blur + Pixelation, damit Gäste das Original nie erhalten
 */
export async function processImage(input: Buffer, ownerId: string): Promise<ProcessedImage> {
  const id = randomUUID();
  const base = sharp(input, { failOn: "error" }).rotate();
  const original = await base.clone().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const thumb = await base.clone().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const blur = await blurVariant(original.data);

  const prefix = `u/${ownerId}/${id}`;
  const storageKey = `${prefix}/o.webp`;
  const thumbKey = `${prefix}/t.webp`;
  const blurKey = `${prefix}/b.webp`;
  await Promise.all([
    putObject(storageKey, original.data, "image/webp"),
    putObject(thumbKey, thumb, "image/webp"),
    putObject(blurKey, blur, "image/webp"),
  ]);
  return {
    storageKey,
    thumbKey,
    blurKey,
    width: original.info.width,
    height: original.info.height,
    sizeBytes: original.data.length,
    sha256: createHash("sha256").update(input).digest("hex"),
  };
}

/** Pixelation (auf 20 px verkleinern, mit nearest vergrössern) plus starker Gauss-Blur. */
export async function blurVariant(input: Buffer) {
  const meta = await sharp(input).metadata();
  const w = Math.min(meta.width ?? 640, 640);
  const small = await sharp(input).resize({ width: 20 }).toBuffer();
  return sharp(small).resize({ width: w, kernel: "nearest" }).blur(18).webp({ quality: 60 }).toBuffer();
}

/** Milchglas-Avatar für Inkognito-Besucher: wird aus dem Thumbnail erzeugt, nie aus dem Original im Client. */
export async function frostedAvatar(input: Buffer) {
  const small = await sharp(input).resize({ width: 8, height: 8, fit: "cover" }).toBuffer();
  return sharp(small).resize({ width: 96, height: 96, kernel: "cubic" }).blur(10).modulate({ brightness: 1.15, saturation: 0.4 }).webp({ quality: 50 }).toBuffer();
}

export async function storeRaw(input: Buffer, ownerId: string, ext: string, mime: string) {
  const key = `u/${ownerId}/${randomUUID()}/f.${ext}`;
  await putObject(key, input, mime);
  return { storageKey: key, sizeBytes: input.length, sha256: createHash("sha256").update(input).digest("hex") };
}

export function extFromMime(mime: string) {
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}
