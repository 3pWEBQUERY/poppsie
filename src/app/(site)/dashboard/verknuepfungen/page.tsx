import type { Metadata } from "next";
import { desc, eq, ne, and } from "drizzle-orm";
import { db } from "@/db";
import { clubLinks } from "@/db/schema";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { LinksManager, type LinkEntry } from "@/components/profile/links-manager";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { zurichToday } from "@/lib/profiles/hours";
import { getSummaries } from "@/lib/users/summary";

export const metadata: Metadata = { title: "Line-up & Clubs" };

export default async function LinksPage() {
  const { user, locked } = await dashboardPage({ types: ["escort", "club"], next: "/dashboard/verknuepfungen" });
  if (locked) return <LockedNotice title="Line-up & Clubs" />;
  const club = user.accountType === "club";
  const rows = await db
    .select()
    .from(clubLinks)
    .where(and(club ? eq(clubLinks.clubId, user.id) : eq(clubLinks.escortId, user.id), ne(clubLinks.status, "rejected")))
    .orderBy(desc(clubLinks.createdAt));
  const otherIds = rows.map((r) => (club ? r.escortId : r.clubId));
  const summaries = await getSummaries(otherIds, user);
  const today = zurichToday();
  const entries: LinkEntry[] = rows.flatMap((r) => {
    const id = club ? r.escortId : r.clubId;
    const s = summaries.get(id);
    if (!s) return [];
    return [
      {
        id,
        name: s.name,
        href: s.href,
        avatarUrl: s.avatarUrl,
        verified: s.verified,
        status: r.status,
        incoming: r.initiatedBy !== user.id,
        presentToday: r.presentOn === today,
      },
    ];
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{club ? "Line-up" : "Clubs & Studios"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {club
            ? "Verknüpfte Girls erscheinen auf deinem Profil im Line-up. Beide Seiten müssen die Verknüpfung bestätigen."
            : "Verknüpfe dich mit den Betrieben, in denen du arbeitest. Der Club muss die Anfrage bestätigen."}
        </p>
      </div>
      <LinksManager initial={entries} accountType={club ? "club" : "escort"} />
    </div>
  );
}
