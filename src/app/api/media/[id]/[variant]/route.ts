import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationMembers, media, messageAttachments, messages } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { verifyMediaSig } from "@/lib/media/urls";
import { presignedGet, readLocal, usesBucket } from "@/lib/storage";

const KEYS = { o: "storageKey", t: "thumbKey", b: "blurKey" } as const;

/** Geschützte Medienauslieferung: Signatur, Ablauf, Blur-Regel für Gäste, Chat-Berechtigung, Hotlink-Schutz. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]/[variant]">) {
  const { id, variant } = await ctx.params;
  const url = new URL(req.url);
  if (!(variant in KEYS) || !verifyMediaSig(id, variant, url.searchParams.get("e"), url.searchParams.get("s"))) {
    return new Response("Ungültiger Link", { status: 403 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") return new Response("Hotlinking nicht erlaubt", { status: 403 });

  const [m] = await db.select().from(media).where(eq(media.id, id));
  if (!m || m.status === "rejected") return new Response("Nicht gefunden", { status: 404 });
  const viewer = await getSessionUser();

  // Gäste erhalten bei aktivem Blur nie das Original.
  if (!viewer && m.blurForGuests && variant !== "b") return new Response("Nur für Mitglieder", { status: 403 });

  if (m.purpose === "message") {
    if (!viewer) return new Response("Nicht erlaubt", { status: 403 });
    const rows = await db
      .select({ viewOnce: messageAttachments.viewOnce, viewedAt: messageAttachments.viewedAt, senderId: messages.senderId, messageId: messages.id })
      .from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, viewer.id)))
      .where(eq(messageAttachments.mediaId, id))
      .limit(1);
    const att = rows[0];
    if (!att) return new Response("Nicht erlaubt", { status: 403 });
    if (att.viewOnce && att.senderId !== viewer.id) {
      if (att.viewedAt) return new Response("Bereits angesehen", { status: 410 });
      await db.update(messageAttachments).set({ viewedAt: new Date() }).where(and(eq(messageAttachments.messageId, att.messageId), eq(messageAttachments.mediaId, id)));
    }
  }

  const key = (m[KEYS[variant as keyof typeof KEYS]] as string | null) ?? m.storageKey;
  const headers = { "Cache-Control": m.purpose === "message" ? "private, no-store" : "private, max-age=300", "X-Content-Type-Options": "nosniff" };
  if (usesBucket) {
    const signed = await presignedGet(key, 600, m.kind === "file" ? (m.fileName ?? "datei.pdf") : undefined);
    return Response.redirect(signed!, 302);
  }
  const buf = await readLocal(key);
  if (!buf) return new Response("Nicht gefunden", { status: 404 });
  const type = key.endsWith(".webp") ? "image/webp" : m.mime;
  return new Response(new Uint8Array(buf), { headers: { ...headers, "Content-Type": type } });
}
