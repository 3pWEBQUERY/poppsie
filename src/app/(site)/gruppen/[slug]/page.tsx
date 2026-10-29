import type { Metadata } from "next";
import { FeedList } from "@/components/feed/feed-list";
import { GroupLocked } from "@/components/groups/group-locked";
import { feedPage } from "@/lib/content/feed";
import { groupBySlug } from "@/lib/groups/access";
import { loadGroupPage } from "@/lib/groups/page-data";
import { viewerCountries } from "@/lib/visibility";

export async function generateMetadata(props: PageProps<"/gruppen/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const g = await groupBySlug(slug);
  return { title: g && g.privacy !== "secret" ? g.name : "Gruppe" };
}

export default async function GroupFeedPage(props: PageProps<"/gruppen/[slug]">) {
  const { slug } = await props.params;
  const { user, group: g, can } = await loadGroupPage(slug);
  if (!can.read) return <GroupLocked text={g.privacy === "private" ? "Diese Gruppe ist privat. Stelle eine Beitrittsanfrage, um Beiträge zu sehen." : undefined} />;
  const page = await feedPage(user, await viewerCountries(user), { kind: "group", groupId: g.id, moderator: can.moderate });
  return (
    <div className="mx-auto w-full max-w-2xl">
      <FeedList
        scope={{ kind: "group", groupId: g.id }}
        initial={page}
        composer={{
          canPost: can.post,
          placeholder: `In ${g.name} posten …`,
          hint: user && !can.post ? "Tritt der Gruppe bei, um mitzuschreiben." : g.requirePostApproval && can.post && !can.moderate ? "In dieser Gruppe werden Beiträge vor der Veröffentlichung geprüft." : undefined,
        }}
        emptyText="Noch keine Beiträge in dieser Gruppe."
      />
    </div>
  );
}
