import { Suspense } from "react";
import { Play } from "lucide-react";
import type { Metadata } from "next";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { PeriodPicker } from "@/components/stats/period-picker";
import { BreakdownBars, ChartCard, KpiTile } from "@/components/stats/stat-blocks";
import { ChartLegend, CompareBars, TrendChart } from "@/components/stats/trend-chart";
import { StarRating } from "@/components/shared/star-rating";
import { localDate } from "@/lib/bookings/format";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { countryName, CANTON_NAMES } from "@/lib/geo/countries";
import { mediaUrl } from "@/lib/media/urls";
import { parsePeriod } from "@/lib/stats/period";
import { getStats } from "@/lib/stats/queries";

export const metadata: Metadata = { title: "Statistiken" };

const SOURCES: Record<string, string> = {
  search: "Suche",
  feed: "Newsfeed",
  story: "Stories",
  matches: "Matches",
  favorites: "Favoriten",
  profile: "Profil",
  external: "Extern",
  direct: "Direkt",
};

function fmtDay(d: string) {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

export default async function StatistikenPage(props: PageProps<"/dashboard/statistiken">) {
  const { user, locked } = await dashboardPage({ types: ["escort", "club"], next: "/dashboard/statistiken" });
  if (locked) return <LockedNotice title="Statistiken" />;
  const sp = await props.searchParams;
  const tz = user.timezone || "Europe/Zurich";
  const period = parsePeriod(sp, tz);
  const isEscort = user.accountType === "escort";
  const s = await getStats(user.id, period, { bookings: isEscort });
  const c = s.totals.cur;
  const p = s.totals.prev;
  const rate = (x: { total: number; confirmed: number }) => (x.total ? (x.confirmed / x.total) * 100 : 0);
  const pctFmt = (v: number) => `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 }).format(v)} %`;
  const ctrSeries = s.impressions.map((x, i) => ({
    ...x,
    value: x.value ? ((s.clicks[i]?.value ?? 0) / x.value) * 100 : 0,
    prev: x.prev ? ((s.clicks[i]?.prev ?? 0) / x.prev) * 100 : 0,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Statistiken</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmtDay(period.fromDate)} – {fmtDay(period.toDate)} · Vergleich mit {fmtDay(s.period.prevFromDate)} – {fmtDay(s.period.prevToDate)}
          </p>
        </div>
        <Suspense>
          <PeriodPicker preset={period.preset} unit={period.unit} fromDate={period.fromDate} toDate={period.toDate} today={localDate(new Date(), tz)} />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Profilaufrufe" value={c.profile_view} prev={p.profile_view} />
        <KpiTile label="Eindeutige Besucher" value={c.unique_views} prev={p.unique_views} />
        <KpiTile label="Suchauftritte" value={c.search_impression} prev={p.search_impression} />
        <KpiTile label="Klickrate (CTR)" value={c.ctr} prev={p.ctr} suffix=" %" decimals={1} />
        <KpiTile label="Neue Chats" value={c.chat_start} prev={p.chat_start} />
        {isEscort ? (
          <>
            <KpiTile label="Buchungsanfragen" value={s.bookings.cur.total} prev={s.bookings.prev.total} />
            <KpiTile label="Bestätigungsquote" value={rate(s.bookings.cur)} prev={rate(s.bookings.prev)} suffix=" %" />
          </>
        ) : (
          <>
            <KpiTile label="Neue Favoriten" value={c.favorite_add} prev={p.favorite_add} />
            <KpiTile label="Neue Follower" value={c.follow} prev={p.follow} />
          </>
        )}
        <KpiTile label="Story-Aufrufe" value={c.story_view} prev={p.story_view} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Profilaufrufe" description="Alle Aufrufe deines Profils" aside={<ChartLegend />}>
          <TrendChart data={s.views} />
        </ChartCard>
        <ChartCard title="Eindeutige Besucher" description="Jede Person einmal pro Abschnitt" aside={<ChartLegend />}>
          <TrendChart data={s.uniques} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Quelle" description="Woher kommen deine Besucher?">
          <BreakdownBars data={s.sources} label={(k) => SOURCES[k] ?? k} />
        </ChartCard>
        <ChartCard title="Land">
          <BreakdownBars data={s.countries} label={(k) => (k ? countryName(k) : "Unbekannt")} />
        </ChartCard>
        <ChartCard title="Kanton / Region">
          <BreakdownBars data={s.regions} label={(k) => CANTON_NAMES[k as keyof typeof CANTON_NAMES] ?? k} empty="Noch keine Regionsdaten" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Suchauftritte" description="Wie oft du in Suchergebnissen angezeigt wurdest" aside={<ChartLegend />}>
          <TrendChart data={s.impressions} />
        </ChartCard>
        <ChartCard title="Klickrate" description="Klicks auf dein Profil pro Suchauftritt" aside={<ChartLegend />}>
          <TrendChart data={ctrSeries} suffix=" %" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Favoriten" description="Mitglieder, die dich gemerkt haben (gesamt)" aside={<ChartLegend />}>
          <TrendChart data={s.favorites} />
        </ChartCard>
        <ChartCard title="Follower" description="Follower gesamt" aside={<ChartLegend />}>
          <TrendChart data={s.followers} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Neue Chats" description="Connect: neu gestartete Unterhaltungen" aside={<ChartLegend />}>
          <CompareBars data={s.chats} />
        </ChartCard>
        {isEscort ? (
          <ChartCard
            title="Buchungsanfragen"
            description={`${s.bookings.cur.confirmed} von ${s.bookings.cur.total} bestätigt (${pctFmt(rate(s.bookings.cur))})`}
            aside={<ChartLegend />}
          >
            <CompareBars data={s.bookingRequests} />
          </ChartCard>
        ) : (
          <ChartCard title="Story-Aufrufe" aside={<ChartLegend />}>
            <CompareBars data={s.storyViews} />
          </ChartCard>
        )}
      </div>

      <ChartCard
        title="Bewertungen"
        description="Durchschnitt aller Berichte im Verlauf"
        aside={
          <span className="flex items-center gap-2 text-sm">
            <StarRating value={s.rating.avg} /> <span className="font-semibold">{s.rating.count ? s.rating.avg.toFixed(2) : "–"}</span>
            <span className="text-muted-foreground">({s.rating.count})</span>
          </span>
        }
      >
        <TrendChart data={s.rating.history.map((h) => ({ key: h.key, label: h.label, value: h.avg as number, prev: 0 }))} comparison={false} dots domain={[0, 5]} height={180} decimals={2} />
      </ChartCard>

      <ChartCard title="Stories im Zeitraum" description="Aufrufe, Likes und Kommentare pro Story">
        {s.stories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Keine Stories in diesem Zeitraum.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Story</th>
                  <th className="pb-2 text-right font-medium">Aufrufe</th>
                  <th className="pb-2 text-right font-medium">Likes</th>
                  <th className="pb-2 text-right font-medium">Kommentare</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.stories.map((st) => (
                  <tr key={st.id}>
                    <td className="py-2">
                      <span className="flex items-center gap-3">
                        <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mediaUrl(st.mediaId, "t")} alt="" className="size-full object-cover" />
                          <Play className="absolute size-3 text-white" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{st.overlay || "Story"}</span>
                          <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("de-CH", { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(new Date(st.createdAt))}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{st.views}</td>
                    <td className="py-2 text-right tabular-nums">{st.likes}</td>
                    <td className="py-2 text-right tabular-nums">{st.comments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
