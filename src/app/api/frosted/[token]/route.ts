import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { decrypt } from "@/lib/auth/crypto";
import { frostedAvatar } from "@/lib/media/process";
import { presignedGet, putObject, readLocal, usesBucket } from "@/lib/storage";

/** Milchglas-Avatar: serverseitig erzeugt, das Originalbild gelangt nie in den Client. */
export async function GET(_req: Request, ctx: RouteContext<"/api/frosted/[token]">) {
  const { token } = await ctx.params;
  let mediaId: string;
  try {
    const p = JSON.parse(decrypt(token)) as { m: string; e: number };
    if (p.e * 1000 < Date.now()) return new Response("Abgelaufen", { status: 410 });
    mediaId = p.m;
  } catch {
    return new Response("Ungültig", { status: 400 });
  }
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m?.thumbKey) return new Response("Nicht gefunden", { status: 404 });
  const frostedKey = m.thumbKey.replace(/t\.webp$/, "f.webp");

  let out: Buffer | null = null;
  if (!usesBucket) out = await readLocal(frostedKey);
  if (!out) {
    const src = usesBucket ? Buffer.from(await (await fetch((await presignedGet(m.thumbKey, 60))!)).arrayBuffer()) : await readLocal(m.thumbKey);
    if (!src) return new Response("Nicht gefunden", { status: 404 });
    out = await frostedAvatar(src);
    await putObject(frostedKey, out, "image/webp");
  }
  return new Response(new Uint8Array(out), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" } });
}
