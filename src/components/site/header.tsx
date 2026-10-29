import Link from "next/link";
import { Suspense } from "react";
import { and, count, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { Bell, Heart, MessageCircle } from "lucide-react";
import { db } from "@/db";
import { conversationMembers, messages, notifications } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages } from "@/lib/i18n/server";
import { getSummary } from "@/lib/users/summary";
import { HeaderIcon } from "./header-icon";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";
import { UserMenu } from "./user-menu";

async function unreadCounts(userId: string) {
  const [msg] = await db
    .select({ n: count() })
    .from(messages)
    .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId)))
    .where(
      and(
        ne(messages.senderId, userId),
        isNull(messages.deletedAt),
        or(isNull(conversationMembers.lastReadAt), gt(messages.createdAt, conversationMembers.lastReadAt)),
        eq(conversationMembers.archived, false),
      ),
    );
  const [notif] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), sql`${notifications.type} <> 'message'`));
  return { messages: msg?.n ?? 0, notifications: notif?.n ?? 0 };
}

export async function SiteHeader() {
  const user = await getSessionUser();
  const { locale, t } = await getMessages();
  const summary = user ? await getSummary(user.id, user) : null;
  const counts = user ? await unreadCounts(user.id) : null;

  const links = user
    ? [
        { href: "/dashboard", label: t.nav.dashboard },
        { href: "/suche", label: t.nav.escorts },
        { href: "/suche?typ=club", label: t.nav.clubs },
        { href: "/feed", label: t.nav.feed },
        { href: "/forum", label: t.nav.forum },
        { href: "/gruppen", label: t.nav.groups },
        { href: "/dashboard/matches", label: "Matches", types: ["member"] },
        { href: "/dashboard/kalender", label: "Kalender" },
      ].filter((l) => !l.types || l.types.includes(user.accountType))
    : [
        { href: "/#was-ist-poppsie", label: t.nav.about },
        { href: "/suche", label: t.nav.escorts },
        { href: "/suche?typ=club", label: t.nav.clubs },
        { href: "/feed", label: t.nav.feed },
        { href: "/forum", label: t.nav.forum },
        { href: "/gruppen", label: t.nav.groups },
      ];

  return (
    <header className="sticky top-0 z-40 border-t-2 border-t-primary bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          {user && summary && counts ? (
            <>
              <HeaderIcon href="/dashboard/nachrichten" label={t.nav.messages} count={counts.messages} live="messages">
                <MessageCircle />
              </HeaderIcon>
              <HeaderIcon href="/dashboard/mitteilungen" label={t.nav.notifications} count={counts.notifications} live="notifications">
                <Bell />
              </HeaderIcon>
              <HeaderIcon href="/dashboard/favoriten" label={t.nav.favorites}>
                <Heart />
              </HeaderIcon>
              <UserMenu user={summary} role={user.role} accountType={user.accountType} logoutLabel={t.nav.logout} />
            </>
          ) : (
            <>
              <LocaleSwitcher locale={locale} />
              <Button size="sm" variant="secondary" asChild>
                <Link href="/anmelden">{t.nav.login}</Link>
              </Button>
              <Button size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/registrieren">{t.nav.register}</Link>
              </Button>
            </>
          )}
          <MobileMenu links={links} label={t.nav.menu} />
        </div>
      </div>
      <div className="border-b bg-band">
        <Suspense fallback={<div className="h-9" />}>
          <MainNav links={links} />
        </Suspense>
      </div>
    </header>
  );
}
