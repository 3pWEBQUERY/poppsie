import type { Metadata } from "next";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { PlannerBoard } from "@/components/planner/planner-board";
import { localDate } from "@/lib/bookings/format";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { listScheduled } from "@/lib/planner/queries";

export const metadata: Metadata = { title: "Planer" };

export default async function PlanerPage() {
  const { user, locked } = await dashboardPage({ types: ["escort", "club"], next: "/dashboard/planer" });
  if (locked) return <LockedNotice title="Planer" />;
  const tz = user.timezone || "Europe/Zurich";
  const items = await listScheduled(user.id);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Planer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Stories, Standortwechsel und Nachrichten an deine Follower im Voraus planen – sie werden automatisch ausgeführt.</p>
      </div>
      <PlannerBoard items={items} timezone={tz} today={localDate(new Date(), tz)} canLocation={user.accountType === "escort"} />
    </div>
  );
}
