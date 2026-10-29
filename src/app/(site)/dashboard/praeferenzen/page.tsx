import type { Metadata } from "next";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { PreferencesForm } from "@/components/matching/preferences-form";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { loadCriteria } from "@/lib/matching/store";

export const metadata: Metadata = { title: "Präferenzen" };

export default async function PreferencesPage() {
  const { user, locked } = await dashboardPage({ types: ["member"], next: "/dashboard/praeferenzen" });
  if (locked) return <LockedNotice title="Präferenzen" />;
  const saved = await loadCriteria(user.id);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Präferenzen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lege fest, was dir wichtig ist. Daraus berechnen wir deine Matches und den Match-Score in Prozent.</p>
      </div>
      <PreferencesForm initial={saved?.criteria ?? {}} hasSaved={Boolean(saved)} />
    </div>
  );
}
