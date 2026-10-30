import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { fmtRange, localDate } from "@/lib/bookings/format";
import { parseRange } from "@/lib/bookings/range";
import { criteriaFor } from "@/lib/reviews/criteria";
import { reviewEligibility, verifiableBookings } from "@/lib/reviews/queries";
import { getSummary } from "@/lib/users/summary";
import { canViewProfile } from "@/lib/visibility";
import type { users } from "@/db/schema";
import { ReviewForm } from "./review-form";

/** Gemeinsame Seite „Bericht schreiben“ für Escorts und Clubs. */
export async function ReviewWritePage({ target, type, profileHref, bookingId }: { target: typeof users.$inferSelect | null; type: "escort" | "club"; profileHref: string; bookingId?: string }) {
  const viewer = await getSessionUser();
  if (!target || !(await canViewProfile(viewer, target))) notFound();
  const summary = await getSummary(target.id, viewer);
  const name = summary?.name ?? target.username;
  const elig = await reviewEligibility(viewer, target.id);
  const options =
    viewer && type === "escort" && elig.allowed
      ? (await verifiableBookings(viewer.id, target.id)).map((b) => {
          const r = parseRange(b.during)!;
          return { id: b.id, label: `Buchung ${fmtRange(r.start, r.end)}`, date: localDate(r.start), durationMin: b.durationMin };
        })
      : [];

  let blocked: React.ReactNode = null;
  if (!elig.allowed) {
    if (elig.reason === "login")
      blocked = (
        <Button asChild>
          <Link href={`/anmelden?next=${encodeURIComponent(`${profileHref}/bericht`)}`}>Anmelden, um einen Bericht zu schreiben</Link>
        </Button>
      );
    else if (elig.reason === "type") blocked = <p className="text-sm text-muted-foreground">Berichte können nur Mitglieder schreiben.</p>;
    else
      blocked = (
        <p className="text-sm text-muted-foreground">
          Du hast {name} in den letzten 30 Tagen bereits bewertet. Ein neuer Bericht ist ab {new Intl.DateTimeFormat("de-CH").format(new Date(elig.nextDate))} möglich.
        </p>
      );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <Link href={profileHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück zum Profil
      </Link>
      <div className="flex items-center gap-4">
        {summary && <UserAvatar user={summary} size="md" />}
        <div>
          <h1 className="text-2xl font-extrabold">Bericht über {name}</h1>
          <p className="text-sm text-muted-foreground">Teile deine Erfahrung ehrlich und respektvoll.</p>
        </div>
      </div>
      {blocked ? (
        <div className="rounded-lg border bg-card p-6">{blocked}</div>
      ) : (
        <ReviewForm target={{ id: target.id, name }} criteria={criteriaFor(type)} bookings={options} initialBookingId={bookingId} today={localDate(new Date())} />
      )}
    </div>
  );
}
