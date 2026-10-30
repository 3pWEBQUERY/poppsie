import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { GroupAdmin } from "@/components/groups/group-admin";
import { GroupForm } from "@/components/groups/group-form";
import { hydratePosts } from "@/lib/content/hydrate";
import { loadGroupPage } from "@/lib/groups/page-data";
import { groupMemberList } from "@/lib/groups/queries";
import { mediaUrl } from "@/lib/media/urls";
import { viewerCountries } from "@/lib/visibility";

export const metadata: Metadata = { title: "Gruppe verwalten" };

export default async function GroupManagePage(props: PageProps<"/gruppen/[slug]/verwalten">) {
  const { slug } = await props.params;
  const { user, group: g, can } = await loadGroupPage(slug);
  if (!user || !can.moderate) notFound();
  const countries = await viewerCountries(user);
  const [requests, invited, banned, queueRows] = await Promise.all([
    groupMemberList(g.id, user, ["pending"]),
    groupMemberList(g.id, user, ["invited"]),
    groupMemberList(g.id, user, ["banned"]),
    db
      .select()
      .from(posts)
      .where(and(eq(posts.groupId, g.id), eq(posts.context, "group"), eq(posts.approved, false), eq(posts.isDraft, false), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(50),
  ]);
  const queue = await hydratePosts(queueRows, user, { countries, moderator: true });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <GroupAdmin groupId={g.id} groupName={g.name} requests={requests} invited={invited} banned={banned} pendingPosts={queue} isOwner={can.owner || user.role === "admin"} />
      {can.admin && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Einstellungen</h2>
          <GroupForm
            groupId={g.id}
            initial={{
              name: g.name,
              description: g.description ?? "",
              rules: g.rules ?? "",
              privacy: g.privacy,
              region: g.region,
              requirePostApproval: g.requirePostApproval,
              cover: g.coverMediaId ? { id: g.coverMediaId, kind: "image", thumbUrl: mediaUrl(g.coverMediaId, "t"), url: mediaUrl(g.coverMediaId, "o") } : null,
            }}
          />
        </div>
      )}
    </div>
  );
}
