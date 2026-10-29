"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Clock, Loader2, LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { joinGroup, leaveGroup } from "@/lib/groups/actions";
import type { GroupPrivacy, MemberStatus } from "@/lib/groups/types";

/** Beitreten / Anfrage senden / Einladung annehmen / Verlassen. */
export function JoinButton({ groupId, privacy, status: initial, isOwner, loggedIn }: { groupId: string; privacy: GroupPrivacy; status: MemberStatus | null; isOwner: boolean; loggedIn: boolean }) {
  const router = useRouter();
  const locked = useLockedHandler();
  const [status, setStatus] = useState(initial);
  const [pending, start] = useTransition();

  if (!loggedIn)
    return (
      <Button onClick={() => router.push(`/anmelden?next=${encodeURIComponent(window.location.pathname)}`)}>
        <UserPlus /> Beitreten
      </Button>
    );
  if (status === "banned") return null;

  const join = () =>
    start(async () => {
      const res = await joinGroup(groupId);
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      setStatus(res.data.status);
      toast.success(res.data.status === "active" ? "Willkommen in der Gruppe!" : "Beitrittsanfrage gesendet");
      router.refresh();
    });
  const leave = () =>
    start(async () => {
      const res = await leaveGroup(groupId);
      if (!res.ok) return void toast.error(res.error);
      setStatus(null);
      router.refresh();
    });

  if (status === "active")
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" disabled={pending}>
            <Check /> Mitglied <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isOwner} onSelect={leave} className="text-destructive focus:text-destructive">
            <LogOut /> {isOwner ? "Inhaber kann nicht austreten" : "Gruppe verlassen"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  if (status === "pending")
    return (
      <Button variant="outline" onClick={leave} disabled={pending} title="Anfrage zurückziehen">
        <Clock /> Anfrage gesendet
      </Button>
    );
  if (status === "invited")
    return (
      <div className="flex gap-2">
        <Button onClick={join} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Einladung annehmen
        </Button>
        <Button variant="outline" onClick={leave} disabled={pending}>
          Ablehnen
        </Button>
      </div>
    );
  if (privacy === "secret") return null;
  return (
    <Button onClick={join} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} {privacy === "private" ? "Beitritt anfragen" : "Beitreten"}
    </Button>
  );
}
