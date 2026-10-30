import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubProfiles, escortProfiles } from "@/db/schema";
import { LockedNotice } from "@/components/dashboard/locked-notice";
import { StoryEditor } from "@/components/stories/story-editor";
import { StoryManageList } from "@/components/stories/story-manage-list";
import { dashboardPage } from "@/lib/dashboard/page-guard";
import { managedStories } from "@/lib/stories/queries";

export const metadata: Metadata = { title: "Stories" };

export default async function DashboardStoriesPage() {
  const { user, locked } = await dashboardPage({ types: ["escort", "club"], next: "/dashboard/stories" });
  if (locked) return <LockedNotice title="Stories" />;
  const [stories, [ep], [cp]] = await Promise.all([
    managedStories(user.id),
    db.select({ city: escortProfiles.city }).from(escortProfiles).where(eq(escortProfiles.userId, user.id)),
    db.select({ city: clubProfiles.city }).from(clubProfiles).where(eq(clubProfiles.userId, user.id)),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Stories</h1>
        <p className="mt-1 text-sm text-muted-foreground">Stories sind 24 Stunden sichtbar – im Newsfeed und als Ring um deinen Avatar. Highlights bleiben dauerhaft im Profil.</p>
      </div>
      <StoryEditor accountType={user.accountType as "escort" | "club"} defaultCity={ep?.city ?? cp?.city ?? null} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Meine Stories</h2>
        <StoryManageList stories={stories} />
      </section>
    </div>
  );
}
