import Link from "next/link";
import type { Metadata } from "next";
import { HeartHandshake, SlidersHorizontal } from "lucide-react";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { MatchesToolbar } from "@/components/matching/matches-toolbar";
import { Pagination } from "@/components/search/pagination";
import { ProfileCard } from "@/components/shared/profile-card";
import { Button } from "@/components/ui/button";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { criteriaCount } from "@/lib/matching/criteria";
import { findMatches } from "@/lib/matching/matches";
import { MATCH_PAGE_SIZE, matchHref, parseMatchQuery } from "@/lib/matching/query";
import { loadCriteria } from "@/lib/matching/store";
import { recordImpressions } from "@/lib/search/page-data";

export const metadata: Metadata = { title: "Meine Matches" };

function Empty({ title, text, cta }: { title: string; text: string; cta: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-16 text-center">
      <HeartHandshake className="size-10 text-muted-foreground" />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      <Button asChild>
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}

export default async function MatchesPage(props: PageProps<"/dashboard/matches">) {
  const { user, locked } = await dashboardPage({ types: ["member"], next: "/dashboard/matches" });
  if (locked) return <LockedNotice title="Meine Matches" />;

  const saved = await loadCriteria(user.id);
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">Meine Matches</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile, die zu deinen Präferenzen passen, sortiert nach Match-Score.</p>
      </div>
      {saved && (
        <Button variant="secondary" size="sm" asChild>
          <Link href="/dashboard/praeferenzen">
            <SlidersHorizontal /> Präferenzen anpassen
          </Link>
        </Button>
      )}
    </div>
  );

  if (!saved || criteriaCount(saved.criteria).total === 0) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Empty
          title="Noch keine Präferenzen"
          text="Lege fest, was dir wichtig ist – Alter, Aussehen, Services, Region und mehr. Danach zeigen wir dir hier passende Escorts und Clubs mit Match-Score."
          cta={{ href: "/dashboard/praeferenzen", label: "Präferenzen festlegen" }}
        />
      </div>
    );
  }

  const q = parseMatchQuery(await props.searchParams);
  const { cards, total, counts } = await findMatches(user, saved.criteria, q);
  await recordImpressions(
    cards.map((c) => c.id),
    user.id,
    "matches",
  );
  const { muss } = criteriaCount(saved.criteria);

  return (
    <div className="flex flex-col gap-5">
      {header}
      <MatchesToolbar q={q} counts={counts} />
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "Match" : "Matches"}
        {muss ? ` · ${muss} Muss-${muss === 1 ? "Kriterium" : "Kriterien"} erfüllt` : ""}
      </p>
      {cards.length === 0 ? (
        <Empty
          title="Keine Matches gefunden"
          text={muss ? "Lockere einzelne Muss-Kriterien oder vergrössere den Umkreis." : "Senke den Mindest-Score oder entferne einzelne Filter."}
          cta={{ href: "/dashboard/praeferenzen", label: "Präferenzen anpassen" }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => (
              <ProfileCard key={c.id} p={c} />
            ))}
          </div>
          <Pagination page={q.seite} totalPages={Math.ceil(total / MATCH_PAGE_SIZE)} hrefFor={(p) => matchHref({ ...q, seite: p })} />
        </>
      )}
    </div>
  );
}
