import Link from "next/link";
import { eq } from "drizzle-orm";
import { Building2, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/db";
import { escortProfiles } from "@/db/schema";
import { AvailabilityEditor } from "@/components/bookings/availability-editor";
import { BookingLists } from "@/components/bookings/booking-lists";
import { BookingSettingsForm } from "@/components/bookings/booking-settings-form";
import { ExceptionsEditor } from "@/components/bookings/exceptions-editor";
import { WeekCalendar } from "@/components/bookings/week-calendar";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { Button } from "@/components/ui/button";
import { DEFAULT_TZ, localDate, mondayOf } from "@/lib/bookings/format";
import { groupBookings, listBookings } from "@/lib/bookings/queries";
import { getAvailability, getBookingSettings } from "@/lib/bookings/settings";
import { dashboardPage } from "@/lib/dashboard/page-guard";

export const metadata: Metadata = { title: "Kalender & Buchungen" };

function Section({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function KalenderPage(props: PageProps<"/dashboard/kalender">) {
  const { user, locked } = await dashboardPage({ next: "/dashboard/kalender" });
  if (locked) return <LockedNotice title="Kalender & Buchungen" />;
  const sp = await props.searchParams;
  const focusId = typeof sp.buchung === "string" ? sp.buchung : undefined;

  if (user.accountType === "club") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold">Kalender & Buchungen</h1>
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
          <Building2 className="size-10 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            Termine werden direkt bei den verknüpften Girls gebucht. Jede Escort verwaltet ihren eigenen Kalender, ihre Zeiten und Preise.
          </p>
          <Button variant="secondary" asChild>
            <Link href="/dashboard/verknuepfungen">Zum Line-up</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isEscort = user.accountType === "escort";
  const settings = isEscort ? await getBookingSettings(user.id) : null;
  const tz = settings?.timezone ?? user.timezone ?? DEFAULT_TZ;
  const { rules, exceptions } = isEscort ? await getAvailability(user.id, tz) : { rules: [], exceptions: [] };
  const all = await listBookings(user.id, isEscort ? "escort" : "member");
  const groups = groupBookings(all);
  const today = localDate(new Date(), tz);
  const week = typeof sp.woche === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.woche) ? mondayOf(sp.woche) : mondayOf(today);
  const [profile] = isEscort ? await db.select({ currency: escortProfiles.currency }).from(escortProfiles).where(eq(escortProfiles.userId, user.id)) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Kalender & Buchungen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEscort ? "Verfügbarkeit pflegen, Anfragen beantworten und Termine im Blick behalten." : "Deine Terminanfragen und gebuchten Treffen."}
          </p>
        </div>
        {isEscort && settings?.enabled && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/escort/${user.username}/buchen`}>
              <ExternalLink /> Meine Buchungsseite
            </Link>
          </Button>
        )}
      </div>

      <Section title="Termine" description={isEscort ? "Bestätige Anfragen innerhalb von 30 Minuten – so lange ist der Slot reserviert." : undefined}>
        <BookingLists groups={groups} viewerId={user.id} focusId={focusId} />
      </Section>

      <Section title="Wochenansicht">
        <WeekCalendar
          weekStart={week}
          timezone={tz}
          bookings={all}
          rules={rules}
          exceptions={exceptions}
          viewerId={user.id}
          hrefFor={(w) => `/dashboard/kalender?woche=${w}`}
        />
      </Section>

      {isEscort && settings && (
        <>
          <Section title="Buchungseinstellungen" description="Dauern, Preise, Puffer und Vorlauf für Online-Anfragen.">
            <BookingSettingsForm initial={settings} currency={profile?.currency ?? "CHF"} />
          </Section>
          <Section title="Wiederkehrende Verfügbarkeit" description="Zu diesen Zeiten können Mitglieder Termine anfragen.">
            <AvailabilityEditor initial={rules} />
          </Section>
          <Section title="Ausnahmen" description="Ferien, Abwesenheiten oder zusätzliche Zeiten.">
            <ExceptionsEditor initial={exceptions} today={today} />
          </Section>
        </>
      )}

      {!isEscort && all.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch keine Termine. Auf den Profilen der Escorts findest du den Button „Buchen“.{" "}
          <Link href="/suche" className="text-foreground underline">
            Escorts finden
          </Link>
        </p>
      )}
    </div>
  );
}
