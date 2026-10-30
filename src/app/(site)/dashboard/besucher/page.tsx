import Link from "next/link";
import type { Metadata } from "next";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Eye } from "lucide-react";
import { db } from "@/db";
import { profileVisits, users } from "@/db/schema";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { UserAvatar } from "@/components/shared/user-avatar";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { zurichToday } from "@/lib/profiles/hours";
import { anonymousSummary, getSummaries } from "@/lib/users/summary";

export const metadata: Metadata = { title: "Profilbesucher" };

const DAYS = 90;

function dayLabel(date: string, today: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400_000);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Gestern";
  return new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}

const time = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });

export default async function VisitorsPage() {
  const { user, locked } = await dashboardPage({ next: "/dashboard/besucher" });
  if (locked) return <LockedNotice title="Profilbesucher" />;

  const today = zurichToday();
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - DAYS * 86400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      visitorId: profileVisits.visitorId,
      date: profileVisits.visitDate,
      count: profileVisits.count,
      incognito: profileVisits.incognito,
      at: profileVisits.lastVisitedAt,
      avatar: users.avatarMediaId,
    })
    .from(profileVisits)
    .innerJoin(users, eq(users.id, profileVisits.visitorId))
    .where(
      and(
        eq(profileVisits.visitedId, user.id),
        gte(profileVisits.visitDate, since),
        eq(users.status, "active"),
        sql`NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ${user.id} AND b.blocked_id = ${profileVisits.visitorId}) OR (b.blocker_id = ${profileVisits.visitorId} AND b.blocked_id = ${user.id}))`,
      ),
    )
    .orderBy(desc(profileVisits.visitDate), desc(profileVisits.lastVisitedAt))
    .limit(2000);

  const summaries = await getSummaries(
    rows.filter((r) => !r.incognito).map((r) => r.visitorId),
    user,
  );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.date, [...(groups.get(r.date) ?? []), r]);
  const unique = new Set(rows.map((r) => r.visitorId)).size;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Profilbesucher</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {unique} {unique === 1 ? "Besucher" : "Besucher"} in den letzten {DAYS} Tagen. Mehrere Besuche am selben Tag werden zusammengefasst.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-14 text-center">
          <Eye className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Noch keine Besucher. Ein vollständiges Profil mit guten Fotos wird öfter angeklickt.</p>
        </div>
      ) : (
        [...groups.entries()].map(([date, list]) => (
          <section key={date} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {dayLabel(date, today)} <span className="font-normal">· {list.length}</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((r) => {
                const s = r.incognito ? null : summaries.get(r.visitorId);
                const anon = s ? null : anonymousSummary(r.avatar);
                const body = (
                  <>
                    <UserAvatar user={s ?? anon!} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s ? s.name : anon!.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {time.format(r.at)} Uhr{r.count > 1 ? ` · ${r.count}× besucht` : ""}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={`${r.visitorId}-${date}`}>
                    {s ? (
                      <Link href={s.href} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/40">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border bg-card p-3" aria-label="Anonymes Mitglied">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
