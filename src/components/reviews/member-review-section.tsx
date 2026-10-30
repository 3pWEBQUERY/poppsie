import { Check, ShieldCheck, X } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { SessionUser } from "@/lib/auth/session";
import { getMemberReviews } from "@/lib/reviews/queries";
import { getSummary } from "@/lib/users/summary";
import { MemberReviewForm } from "./member-review-form";

function Flag({ value, label }: { value: boolean | null; label: string }) {
  if (value === null) return null;
  return (
    <span className={value ? "inline-flex items-center gap-1 text-success" : "inline-flex items-center gap-1 text-destructive"}>
      {value ? <Check className="size-3.5" /> : <X className="size-3.5" />} {value ? label : `nicht ${label.toLowerCase()}`}
    </span>
  );
}

/** Berichte von Anbieterinnen über ein Mitglied – nur für Escorts/Clubs (und Moderation) sichtbar. */
export async function MemberReviewSection({ memberId, viewer }: { memberId: string; viewer: SessionUser | null }) {
  if (!viewer) return null;
  const provider = viewer.accountType === "escort" || viewer.accountType === "club";
  const staff = viewer.role === "admin" || viewer.role === "moderator";
  if (!provider && !staff) return null;
  const [data, member] = await Promise.all([getMemberReviews(memberId, viewer), getSummary(memberId, viewer)]);
  if (!member) return null;

  return (
    <section id="mitglied-berichte" className="flex scroll-mt-24 flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="size-5 text-primary" /> Bewertungen von Anbieterinnen
        </h2>
        <span className="text-xs text-muted-foreground">Nur für Escorts und Clubs sichtbar</span>
      </div>
      {data.count > 0 ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="font-display text-2xl font-extrabold">{data.avg.toFixed(1)}</span>
            <StarRating value={data.avg} />
            <span className="text-muted-foreground">({data.count})</span>
          </span>
          <span className="text-muted-foreground">
            {data.reliable}× zuverlässig · {data.respectful}× respektvoll
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Bewertungen zu {member.name}.</p>
      )}
      {data.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.items.map((r) => (
            <li key={r.id} className="flex items-start gap-3">
              <UserAvatar user={r.author ?? { name: "Anbieterin", avatarUrl: null }} size="sm" link />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-semibold">{r.author?.name ?? "Anbieterin"}</span>
                  <StarRating value={r.rating} size="xs" />
                  <Flag value={r.reliable} label="Zuverlässig" />
                  <Flag value={r.respectful} label="Respektvoll" />
                  <span className="text-muted-foreground">{new Intl.DateTimeFormat("de-CH").format(new Date(r.createdAt))}</span>
                </div>
                {r.body && <p className="mt-1 rounded-md border border-foreground/15 px-3 py-2 text-sm whitespace-pre-wrap">{r.body}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {provider && viewer.id !== memberId && <MemberReviewForm memberId={memberId} memberName={member.name} />}
    </section>
  );
}
