import Link from "next/link";
import { PenLine, Star } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import { criteriaFor, type ReviewSort } from "@/lib/reviews/criteria";
import { getProfileReviews, reviewEligibility, reviewTarget } from "@/lib/reviews/queries";
import { ReviewList } from "./review-list";

function normalizeSort(s?: string): ReviewSort {
  return s === "beste" || s === "schlechteste" ? s : "neueste";
}

/** Berichte auf Profilseiten (Escort/Club): Durchschnitt, Verteilung, sortierbare Liste. */
export async function ReviewSection({ targetId, targetType, viewer, sort }: { targetId: string; targetType: "escort" | "club"; viewer: SessionUser | null; sort?: string }) {
  const [{ items, stats }, target, elig] = await Promise.all([getProfileReviews(targetId, viewer), reviewTarget(targetId), reviewEligibility(viewer, targetId)]);
  const criteria = criteriaFor(targetType);
  const writeHref = target?.writeHref ?? "#";
  const isSelf = viewer?.id === targetId;

  return (
    <section id="berichte" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-extrabold">Berichte {stats.count > 0 && <span className="text-muted-foreground">({stats.count})</span>}</h2>
        {!isSelf &&
          (elig.allowed ? (
            <Button asChild>
              <Link href={writeHref}>
                <PenLine /> Bericht schreiben
              </Link>
            </Button>
          ) : elig.reason === "login" ? (
            <Button variant="secondary" asChild>
              <Link href={`/anmelden?next=${encodeURIComponent(writeHref)}`}>Anmelden, um zu berichten</Link>
            </Button>
          ) : elig.reason === "interval" ? (
            <span className="text-xs text-muted-foreground">Nächster Bericht ab {new Intl.DateTimeFormat("de-CH").format(new Date(elig.nextDate))} möglich</span>
          ) : null)}
      </div>

      {stats.count > 0 ? (
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[auto_1fr_1fr] sm:p-5">
          <div className="flex flex-col items-center justify-center gap-1 sm:pr-4">
            <span className="font-display text-4xl font-extrabold">{stats.avg.toFixed(1)}</span>
            <StarRating value={stats.avg} />
            <span className="text-xs text-muted-foreground">{stats.count === 1 ? "1 Bericht" : `${stats.count} Berichte`}</span>
          </div>
          <div className="flex flex-col gap-1">
            {stats.distribution.map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="inline-flex w-7 items-center gap-0.5 tabular-nums">
                  {5 - i} <Star className="size-3 fill-current" />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / stats.count) * 100}%` }} />
                </span>
                <span className="w-6 text-right text-muted-foreground tabular-nums">{n}</span>
              </div>
            ))}
          </div>
          <dl className="flex flex-col gap-1.5">
            {criteria.map((c) =>
              stats.criteria[c.key] ? (
                <div key={c.key} className="flex items-center justify-between gap-2 text-xs">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="flex items-center gap-1.5">
                    <StarRating value={stats.criteria[c.key]!} size="xs" label={c.label} />
                    <span className="w-6 tabular-nums">{stats.criteria[c.key]!.toFixed(1)}</span>
                  </dd>
                </div>
              ) : null,
            )}
          </dl>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Noch keine Berichte. Sei der Erste!</p>
      )}

      <ReviewList items={items} viewer={viewer ? { id: viewer.id, accountType: viewer.accountType } : null} criteria={criteria} initialSort={normalizeSort(sort)} />
    </section>
  );
}
