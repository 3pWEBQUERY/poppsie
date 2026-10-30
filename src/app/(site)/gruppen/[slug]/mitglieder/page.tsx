import type { Metadata } from "next";
import { GroupLocked } from "@/components/groups/group-locked";
import { MemberList } from "@/components/groups/member-list";
import { isStaff } from "@/lib/auth/guards";
import { loadGroupPage } from "@/lib/groups/page-data";
import { groupMemberList } from "@/lib/groups/queries";

export const metadata: Metadata = { title: "Mitglieder" };

export default async function GroupMembersPage(props: PageProps<"/gruppen/[slug]/mitglieder">) {
  const { slug } = await props.params;
  const { user, group: g, membership, can } = await loadGroupPage(slug);
  if (!can.read) return <GroupLocked text="Die Mitgliederliste ist nur für Mitglieder sichtbar." />;
  const members = await groupMemberList(g.id, user, ["active"]);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{g.memberCount} Mitglieder</h2>
      <MemberList groupId={g.id} members={members} viewerId={user?.id ?? null} viewerRole={membership?.status === "active" ? membership.role : null} staff={isStaff(user)} />
    </div>
  );
}
