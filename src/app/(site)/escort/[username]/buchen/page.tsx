import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, CalendarX } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/db";
import { escortProfiles, users } from "@/db/schema";
import { BookingWizard } from "@/components/bookings/booking-wizard";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getBookingSettings } from "@/lib/bookings/settings";
import { getSummary } from "@/lib/users/summary";
import { canViewProfile } from "@/lib/visibility";

export const metadata: Metadata = { title: "Termin buchen" };

async function loadEscort(username: string) {
  const [row] = await db
    .select({ user: users, currency: escortProfiles.currency, name: escortProfiles.displayName })
    .from(users)
    .innerJoin(escortProfiles, eq(escortProfiles.userId, users.id))
    .where(and(eq(users.username, decodeURIComponent(username).toLowerCase()), eq(users.accountType, "escort")));
  return row ?? null;
}

export default async function BuchenPage(props: PageProps<"/escort/[username]/buchen">) {
  const { username } = await props.params;
  const viewer = await getSessionUser();
  const row = await loadEscort(username);
  if (!row || !(await canViewProfile(viewer, row.user))) notFound();
  const escort = row.user;
  const settings = await getBookingSettings(escort.id);
  const summary = await getSummary(escort.id, viewer);
  const name = row.name || escort.username;
  const own = viewer?.id === escort.id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <Link href={`/escort/${escort.username}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück zum Profil
      </Link>
      <div className="flex items-center gap-4">
        {summary && <UserAvatar user={summary} size="md" />}
        <div>
          <h1 className="text-2xl font-extrabold">Termin mit {name}</h1>
          <p className="text-sm text-muted-foreground">Anfrage ist unverbindlich, bezahlt wird vor Ort.</p>
        </div>
      </div>
      {own && (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Vorschau deiner Buchungsseite. Einstellungen änderst du unter{" "}
          <Link href="/dashboard/kalender" className="text-foreground underline">
            Kalender & Buchungen
          </Link>
          .
        </p>
      )}
      {!settings.enabled || settings.durations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
          <CalendarX className="size-10 text-muted-foreground" />
          <p className="font-semibold">{name} nimmt zurzeit keine Online-Buchungen an.</p>
          <Button variant="secondary" asChild>
            <Link href={`/escort/${escort.username}`}>Zum Profil</Link>
          </Button>
        </div>
      ) : (
        <BookingWizard
          escort={{ id: escort.id, name, username: escort.username }}
          settings={{ ...settings }}
          currency={row.currency}
          viewer={{ loggedIn: Boolean(viewer), isMember: viewer?.accountType === "member" }}
        />
      )}
    </div>
  );
}
