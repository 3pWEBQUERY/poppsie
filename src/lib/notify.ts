import { db } from "@/db";
import { notifications } from "@/db/schema";
import { publish } from "@/lib/realtime/publish";

export async function notify(userId: string, n: { type: string; title: string; body?: string; href?: string; actorId?: string }) {
  const [row] = await db
    .insert(notifications)
    .values({ userId, type: n.type, title: n.title, body: n.body, href: n.href, actorId: n.actorId })
    .returning({ id: notifications.id });
  await publish([userId], { type: "notification", id: row!.id, title: n.title, href: n.href });
  return row!.id;
}

export async function notifyMany(userIds: string[], n: { type: string; title: string; body?: string; href?: string; actorId?: string }) {
  if (userIds.length === 0) return;
  const rows = await db
    .insert(notifications)
    .values(userIds.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, href: n.href, actorId: n.actorId })))
    .returning({ id: notifications.id, userId: notifications.userId });
  await Promise.all(rows.map((r) => publish([r.userId], { type: "notification", id: r.id, title: n.title, href: n.href })));
}
