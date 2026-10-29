import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, hasBucket } from "@/lib/env";

/**
 * Dateiablage: Railway Bucket (privat, S3-kompatibel) in Produktion, lokal der Ordner .uploads/.
 * Ausgeliefert wird nie direkt, sondern über /api/media/... mit Rechteprüfung und
 * kurzlebiger signierter Weiterleitung auf den Bucket.
 */
const s3 = hasBucket
  ? new S3Client({
      region: env.bucket.region,
      endpoint: env.bucket.endpoint,
      forcePathStyle: false,
      credentials: { accessKeyId: env.bucket.accessKeyId!, secretAccessKey: env.bucket.secretAccessKey! },
    })
  : null;

const UPLOAD_DIR = path.resolve(process.cwd(), ".uploads");

function localPath(key: string) {
  const p = path.resolve(UPLOAD_DIR, key);
  if (!p.startsWith(UPLOAD_DIR + path.sep)) throw new Error("Ungültiger Schlüssel");
  return p;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: env.bucket.name, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function deleteObject(key: string) {
  if (s3) await s3.send(new DeleteObjectCommand({ Bucket: env.bucket.name, Key: key }));
  else await rm(localPath(key), { force: true });
}

/** Signierte, ablaufende URL (Standard 10 Minuten). */
export async function presignedGet(key: string, expiresIn = 600, downloadName?: string) {
  if (!s3) return null;
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.bucket.name,
      Key: key,
      ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName.replace(/"/g, "")}"` : undefined,
    }),
    { expiresIn },
  );
}

export async function readLocal(key: string) {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}

export const usesBucket = Boolean(s3);
