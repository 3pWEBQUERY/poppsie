import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { visibilityBlocks } from "@/db/schema";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { CountryBlocker } from "@/components/profile/country-blocker";
import { PrivacySettings } from "@/components/profile/privacy-settings";
import { dashboardPage } from "@/lib/dashboard/page-guard";

export const metadata: Metadata = { title: "Sichtbarkeit & Privatsphäre" };

export default async function VisibilityPage() {
  const { user, locked } = await dashboardPage({ next: "/dashboard/sichtbarkeit" });
  if (locked) return <LockedNotice title="Sichtbarkeit & Privatsphäre" />;
  const blocks = await db.select({ c: visibilityBlocks.countryCode }).from(visibilityBlocks).where(eq(visibilityBlocks.userId, user.id));
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold">Sichtbarkeit & Privatsphäre</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bestimme, wer dein Profil sieht und was andere über dich erfahren.</p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">Profil-Sichtbarkeit</h2>
        <PrivacySettings initial={{ profileHidden: user.profileHidden, incognito: user.incognito, showOnline: user.showOnline, readReceipts: user.readReceipts }} />
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold">Länder sperren</h2>
          <p className="text-xs text-muted-foreground">
            Besucher aus gesperrten Ländern (Standort oder Profil-Land) sehen dein Profil nicht – weder in der Suche, im Feed, in Stories noch per Direktlink.
          </p>
        </div>
        <CountryBlocker initialBlocked={blocks.map((b) => b.c)} ownCountry={user.country} />
      </section>
    </div>
  );
}
