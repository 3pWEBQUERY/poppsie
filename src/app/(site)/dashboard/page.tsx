import Link from "next/link";
import { and, count, eq, gt, gte, inArray } from "drizzle-orm";
import { CalendarDays, Eye, Heart, MessageCircle, Search, Star, UserPen } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, favorites, profileVisits, reviews } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/guards";
import { getSummary } from "@/lib/users/summary";

export const metadata: Metadata = { title: "Mein Bereich" };

async function overview(userId: string, type: string) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const [visits] = await db.select({ n: count() }).from(profileVisits).where(and(eq(profileVisits.visitedId, userId), gte(profileVisits.visitDate, since)));
  const [favs] = await db.select({ n: count() }).from(favorites).where(type === "member" ? eq(favorites.userId, userId) : eq(favorites.targetId, userId));
  const [revs] = await db.select({ n: count() }).from(reviews).where(type === "member" ? eq(reviews.authorId, userId) : eq(reviews.targetId, userId));
  const [upcoming] = await db
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        type === "member" ? eq(bookings.memberId, userId) : eq(bookings.escortId, userId),
        inArray(bookings.status, ["requested", "countered", "confirmed"]),
        gt(bookings.createdAt, new Date(Date.now() - 60 * 86400_000)),
      ),
    );
  return { visits: visits?.n ?? 0, favs: favs?.n ?? 0, reviews: revs?.n ?? 0, upcoming: upcoming?.n ?? 0 };
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requirePageUser();
  const sp = await props.searchParams;
  const me = await getSummary(user.id, user);
  const o = await overview(user.id, user.accountType);
  const provider = user.accountType !== "member";
  const tiles = [
    { href: "/dashboard/besucher", label: "Profilbesucher (7 Tage)", value: o.visits, icon: Eye },
    { href: "/dashboard/favoriten", label: provider ? "Als Favorit gemerkt" : "Favoriten", value: o.favs, icon: Heart },
    { href: "/dashboard/berichte", label: provider ? "Erhaltene Berichte" : "Geschriebene Berichte", value: o.reviews, icon: Star },
    { href: "/dashboard/kalender", label: "Offene Termine", value: o.upcoming, icon: CalendarDays },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{sp.willkommen ? `Willkommen bei Poppsie, ${me?.name}!` : `Hallo ${me?.name}`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {provider ? "Hier verwaltest du Profil, Termine, Stories und Statistiken." : "Hier findest du Favoriten, Matches, Nachrichten und deine Termine."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/40">
            <t.icon className="size-5 text-primary" />
            <span className="font-display text-2xl font-bold">{t.value}</span>
            <span className="text-xs text-muted-foreground">{t.label}</span>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild>
          <Link href="/dashboard/profil">
            <UserPen /> Profil bearbeiten
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard/nachrichten">
            <MessageCircle /> Nachrichten
          </Link>
        </Button>
        {!provider && (
          <Button variant="secondary" asChild>
            <Link href="/suche">
              <Search /> Escorts finden
            </Link>
          </Button>
        )}
        {me && (
          <Button variant="outline" asChild>
            <Link href={me.href}>Öffentliches Profil ansehen</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
