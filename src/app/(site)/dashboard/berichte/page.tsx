import Link from "next/link";
import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { MemberReviewForm } from "@/components/reviews/member-review-form";
import { ReviewList } from "@/components/reviews/review-list";
import { StarRating } from "@/components/shared/star-rating";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { fmtRange } from "@/lib/bookings/format";
import { parseRange } from "@/lib/bookings/range";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { CLUB_CRITERIA, criteriaFor, ESCORT_CRITERIA } from "@/lib/reviews/criteria";
import { getReceivedReviews, getWrittenReviews, membersToRate, pendingReviewInvites } from "@/lib/reviews/queries";

export const metadata: Metadata = { title: "Berichte" };

export default async function BerichtePage() {
  const { user, locked } = await dashboardPage({ next: "/dashboard/berichte" });
  if (locked) return <LockedNotice title="Berichte" />;
  const viewer = { id: user.id, accountType: user.accountType };

  if (user.accountType === "member") {
    const [written, invites] = await Promise.all([getWrittenReviews(user.id), pendingReviewInvites(user.id)]);
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold">Meine Berichte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Berichte, die du über Escorts und Clubs geschrieben hast.</p>
        </div>
        {invites.length > 0 && (
          <section className="flex flex-col gap-3 rounded-lg border border-primary/50 bg-card p-4">
            <h2 className="font-bold">Wie war dein Treffen?</h2>
            {invites.map((i) => {
              const r = parseRange(i.during);
              return (
                <div key={i.id} className="flex flex-wrap items-center gap-3">
                  {i.escort && <UserAvatar user={i.escort} size="sm" link />}
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-semibold">{i.escort?.name}</div>
                    {r && <div className="text-xs text-muted-foreground">{fmtRange(r.start, r.end)}</div>}
                  </div>
                  {i.escort && (
                    <Button size="sm" asChild>
                      <Link href={`/escort/${i.escort.username}/bericht?buchung=${i.id}`}>
                        <PenLine /> Bericht schreiben
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </section>
        )}
        {written.length ? (
          <ReviewList items={written} viewer={viewer} criteria={[...ESCORT_CRITERIA, ...CLUB_CRITERIA.filter((c) => c.key !== "service")]} showTarget />
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Du hast noch keine Berichte geschrieben.</p>
        )}
      </div>
    );
  }

  const [{ items, stats }, toRate] = await Promise.all([getReceivedReviews(user.id), user.accountType === "escort" ? membersToRate(user.id) : Promise.resolve([])]);
  const open = items.filter((i) => !i.ownerReply).length;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Erhaltene Berichte</h1>
        <p className="mt-1 text-sm text-muted-foreground">Du kannst auf jeden Bericht einmal öffentlich antworten. Unangemessene Berichte kannst du melden.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <span className="font-display text-2xl font-bold">{stats.count ? stats.avg.toFixed(1) : "–"}</span>
          <StarRating value={stats.avg} size="xs" />
          <span className="text-xs text-muted-foreground">Durchschnitt</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <span className="font-display text-2xl font-bold">{stats.count}</span>
          <span className="text-xs text-muted-foreground">Berichte</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <span className="font-display text-2xl font-bold">{open}</span>
          <span className="text-xs text-muted-foreground">Ohne Antwort</span>
        </div>
      </div>
      {items.length ? (
        <ReviewList items={items} viewer={viewer} criteria={criteriaFor(user.accountType === "club" ? "club" : "escort")} />
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Berichte erhalten.</p>
      )}
      {toRate.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold">Mitglieder bewerten</h2>
            <p className="text-sm text-muted-foreground">Aus deinen erledigten Terminen. Nur für Anbieterinnen sichtbar.</p>
          </div>
          {toRate.slice(0, 5).map((m) => (
            <MemberReviewForm key={m.id} memberId={m.id} memberName={m.name} />
          ))}
        </section>
      )}
    </div>
  );
}
