import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { Messenger } from "@/components/messenger/messenger";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { findConversation } from "@/lib/messaging/core";
import { getMessagesPage, getThreadMeta, listConversations, partnerOf } from "@/lib/messaging/queries";
import type { ThreadData, ThreadMeta } from "@/lib/messaging/types";
import { getSummary } from "@/lib/users/summary";
import { canViewProfile } from "@/lib/visibility";

export const metadata: Metadata = { title: "Nachrichten" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MessagesPage(props: PageProps<"/dashboard/nachrichten">) {
  const { user, locked } = await dashboardPage({ next: "/dashboard/nachrichten" });
  if (locked) return <LockedNotice title="Nachrichten" />;
  const sp = await props.searchParams;
  let c = typeof sp.c === "string" && UUID.test(sp.c) ? sp.c : null;
  const mit = typeof sp.mit === "string" ? sp.mit.trim().slice(0, 60) : null;
  let draft: ThreadMeta | null = null;
  let notice: string | null = null;

  // Connect-Deep-Link: ?mit=<username> öffnet den bestehenden Chat oder einen neuen Entwurf.
  if (mit) {
    const [target] = await db.select().from(users).where(eq(sql`lower(${users.username})`, mit.toLowerCase()));
    if (!target || target.id === user.id) {
      notice = target ? null : "Profil nicht gefunden";
    } else {
      const existing = await findConversation(user.id, target.id);
      const hasMessages = existing ? (await db.select({ id: messages.id }).from(messages).where(eq(messages.conversationId, existing)).limit(1)).length > 0 : false;
      if (existing && hasMessages) c = existing;
      else if (await canViewProfile(user, target)) draft = await getThreadMeta(user, target.id, null);
      else notice = "Profil nicht gefunden";
    }
  }

  const [list, me] = await Promise.all([listConversations(user), getSummary(user.id, user)]);
  let thread: ThreadData | null = null;
  if (c && !draft) {
    const partnerId = await partnerOf(c, user.id);
    const meta = partnerId ? await getThreadMeta(user, partnerId, c) : null;
    if (meta) thread = { meta, page: await getMessagesPage(c, user.id) };
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">Nachrichten</h1>
      <Messenger me={{ id: user.id, name: me?.name ?? user.username }} initialList={list} initialThread={thread} draft={draft} notice={notice} />
    </div>
  );
}
