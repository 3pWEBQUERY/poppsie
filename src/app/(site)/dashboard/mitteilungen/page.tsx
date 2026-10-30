import type { Metadata } from "next";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { NotificationList } from "@/components/account/notification-list";
import { requirePageUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Mitteilungen" };

/** Mitteilungen: auch mit unvollständigem Profil frei zugänglich. */
export default async function NotificationsPage() {
  const user = await requirePageUser({ next: "/dashboard/mitteilungen" });
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    // Chat-Nachrichten zählen im Messenger, nicht hier (wie der Zähler im Header)
    .where(and(eq(notifications.userId, user.id), ne(notifications.type, "message")))
    .orderBy(desc(notifications.createdAt))
    .limit(150);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Mitteilungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Neue Mitteilungen erscheinen automatisch.</p>
      </div>
      <NotificationList
        items={rows.map((r) => ({ ...r, readAt: r.readAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
