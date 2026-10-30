"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Ban, Crown, MoreHorizontal, Shield, ShieldCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { manageMember, transferOwnership } from "@/lib/groups/actions";
import type { GroupMemberView, GroupRoleName } from "@/lib/groups/types";

const ROLE: Record<GroupRoleName, { label: string; cls: string }> = {
  owner: { label: "Inhaber", cls: "bg-primary text-primary-foreground" },
  admin: { label: "Admin", cls: "bg-primary/15 text-primary" },
  moderator: { label: "Moderator", cls: "bg-secondary text-foreground" },
  member: { label: "", cls: "" },
};
const RANK: Record<GroupRoleName, number> = { member: 1, moderator: 2, admin: 3, owner: 4 };

/** Mitgliederliste mit Verwaltung (Rollen, entfernen, sperren, übertragen) je nach eigener Rolle. */
export function MemberList({
  groupId,
  members,
  viewerId,
  viewerRole,
  staff,
}: {
  groupId: string;
  members: GroupMemberView[];
  viewerId: string | null;
  viewerRole: GroupRoleName | null;
  staff: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(members);
  const [pending, start] = useTransition();
  const myRank = staff ? 5 : viewerRole ? RANK[viewerRole] : 0;

  const act = (userId: string, action: "remove" | "ban" | "role", role?: "admin" | "moderator" | "member") =>
    start(async () => {
      const res = await manageMember({ groupId, userId, action, role });
      if (!res.ok) return void toast.error(res.error);
      if (action === "role") setList((l) => l.map((m) => (m.userId === userId ? { ...m, role: role! } : m)));
      else setList((l) => l.filter((m) => m.userId !== userId));
      toast.success(action === "ban" ? "Mitglied gesperrt" : action === "remove" ? "Mitglied entfernt" : "Rolle geändert");
    });

  const transfer = (userId: string, name: string) => {
    if (!confirm(`Gruppe wirklich an ${name} übertragen? Du wirst danach Admin.`)) return;
    start(async () => {
      const res = await transferOwnership({ groupId, userId });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Gruppe übertragen");
      router.refresh();
    });
  };

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {list.map((m) => {
        const manageable = m.userId !== viewerId && m.role !== "owner" && myRank >= 2 && myRank > RANK[m.role];
        return (
          <li key={m.userId} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <UserAvatar user={{ name: m.name, avatarUrl: m.avatarUrl, href: m.href }} link size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Link href={m.href} className="truncate text-sm font-semibold hover:underline">
                  {m.name}
                </Link>
                {m.verified && <BadgeCheck className="size-4 shrink-0 text-primary" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {ROLE[m.role].label && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ROLE[m.role].cls}`}>{ROLE[m.role].label}</span>}
                <span>seit {new Date(m.since).toLocaleDateString("de-CH")}</span>
              </div>
            </div>
            {manageable && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`${m.name} verwalten`} disabled={pending}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {myRank >= 3 && (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Rolle</DropdownMenuLabel>
                      {(viewerRole === "owner" || staff) && m.role !== "admin" && (
                        <DropdownMenuItem onSelect={() => act(m.userId, "role", "admin")}>
                          <ShieldCheck /> Zum Admin machen
                        </DropdownMenuItem>
                      )}
                      {m.role !== "moderator" && (
                        <DropdownMenuItem onSelect={() => act(m.userId, "role", "moderator")}>
                          <Shield /> Zum Moderator machen
                        </DropdownMenuItem>
                      )}
                      {m.role !== "member" && <DropdownMenuItem onSelect={() => act(m.userId, "role", "member")}>Rolle entfernen</DropdownMenuItem>}
                      {(viewerRole === "owner" || staff) && (
                        <DropdownMenuItem onSelect={() => transfer(m.userId, m.name)}>
                          <Crown /> Gruppe übertragen
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => act(m.userId, "remove")}>
                    <UserMinus /> Entfernen
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => act(m.userId, "ban")} className="text-destructive focus:text-destructive">
                    <Ban /> Sperren
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        );
      })}
    </ul>
  );
}
