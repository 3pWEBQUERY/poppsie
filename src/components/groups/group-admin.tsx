"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { EmbedCard } from "@/components/content/embed-card";
import { MediaGrid } from "@/components/content/media-grid";
import { RelativeTime } from "@/components/content/relative-time";
import { RichText } from "@/components/shared/rich-text";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PostView } from "@/lib/content/types";
import { deleteGroup, inviteToGroup, manageMember, reviewPost } from "@/lib/groups/actions";
import type { GroupMemberView } from "@/lib/groups/types";

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        {title}
        {count ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function Person({ m, children }: { m: GroupMemberView; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <UserAvatar user={{ name: m.name, avatarUrl: m.avatarUrl, href: m.href }} link size="sm" />
      <Link href={m.href} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
        {m.name}
      </Link>
      {children}
    </li>
  );
}

/** Verwaltung: Anfragen, Freigaben, Einladungen, Sperren, Gruppe löschen. */
export function GroupAdmin({
  groupId,
  groupName,
  requests,
  invited,
  banned,
  pendingPosts,
  isOwner,
}: {
  groupId: string;
  groupName: string;
  requests: GroupMemberView[];
  invited: GroupMemberView[];
  banned: GroupMemberView[];
  pendingPosts: PostView[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [reqs, setReqs] = useState(requests);
  const [bans, setBans] = useState(banned);
  const [queue, setQueue] = useState(pendingPosts);
  const [username, setUsername] = useState("");
  const [pending, start] = useTransition();

  const member = (userId: string, action: "approve" | "reject" | "unban") =>
    start(async () => {
      const res = await manageMember({ groupId, userId, action });
      if (!res.ok) return void toast.error(res.error);
      if (action === "unban") setBans((l) => l.filter((m) => m.userId !== userId));
      else setReqs((l) => l.filter((m) => m.userId !== userId));
      router.refresh();
    });

  const review = (postId: string, approve: boolean) =>
    start(async () => {
      const res = await reviewPost({ postId, approve });
      if (!res.ok) return void toast.error(res.error);
      setQueue((l) => l.filter((p) => p.id !== postId));
      toast.success(approve ? "Beitrag freigegeben" : "Beitrag abgelehnt");
    });

  const invite = () =>
    start(async () => {
      const res = await inviteToGroup({ groupId, username });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.status === "active" ? "Anfrage angenommen" : "Einladung gesendet");
      setUsername("");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <Section title="Beitrittsanfragen" count={reqs.length}>
        {reqs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine offenen Anfragen.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reqs.map((m) => (
              <Person key={m.userId} m={m}>
                <Button size="sm" onClick={() => member(m.userId, "approve")} disabled={pending}>
                  <Check /> Annehmen
                </Button>
                <Button size="sm" variant="outline" onClick={() => member(m.userId, "reject")} disabled={pending}>
                  <X /> Ablehnen
                </Button>
              </Person>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Beiträge zur Freigabe" count={queue.length}>
        {queue.length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine Beiträge in der Warteschlange.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-md border bg-background/40 p-3">
                <div className="flex items-center gap-2 text-xs">
                  <UserAvatar user={p.author} size="xs" />
                  <span className="font-semibold">{p.author.name}</span>
                  <RelativeTime iso={p.createdAt} className="text-muted-foreground" />
                </div>
                {p.body && <RichText text={p.body} className="text-sm" />}
                <MediaGrid items={p.media} className="max-w-sm" />
                {p.embeds.map((e) => (
                  <EmbedCard key={`${e.type}:${e.id}`} e={e} />
                ))}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review(p.id, true)} disabled={pending}>
                    <Check /> Freigeben
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => review(p.id, false)} disabled={pending}>
                    <X /> Ablehnen
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Mitglieder einladen">
        <div className="flex gap-2">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Benutzername, z. B. max.muster" aria-label="Benutzername" onKeyDown={(e) => e.key === "Enter" && invite()} />
          <Button onClick={invite} disabled={pending || username.trim().length < 3}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />} Einladen
          </Button>
        </div>
        {invited.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Offene Einladungen</p>
            <ul className="flex flex-col gap-2">
              {invited.map((m) => (
                <Person key={m.userId} m={m}>
                  <Button size="sm" variant="ghost" onClick={() => member(m.userId, "reject")} disabled={pending}>
                    Zurückziehen
                  </Button>
                </Person>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Gesperrte Mitglieder" count={bans.length}>
        {bans.length === 0 ? (
          <p className="text-xs text-muted-foreground">Niemand gesperrt.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bans.map((m) => (
              <Person key={m.userId} m={m}>
                <Button size="sm" variant="outline" onClick={() => member(m.userId, "unban")} disabled={pending}>
                  Entsperren
                </Button>
              </Person>
            ))}
          </ul>
        )}
      </Section>

      {isOwner && (
        <section className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-card p-4">
          <h2 className="text-sm font-bold text-destructive">Gefahrenzone</h2>
          <p className="text-xs text-muted-foreground">Die Gruppe mit allen Beiträgen und dem Gruppen-Forum wird endgültig gelöscht. Übertragen kannst du die Gruppe in der Mitgliederliste.</p>
          <Button
            variant="destructive"
            className="w-fit"
            disabled={pending}
            onClick={() => {
              if (prompt(`Zum Bestätigen den Gruppennamen eingeben: ${groupName}`) !== groupName) return;
              start(async () => {
                const res = await deleteGroup(groupId);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Gruppe gelöscht");
                router.push("/gruppen");
              });
            }}
          >
            <Trash2 /> Gruppe löschen
          </Button>
        </section>
      )}
    </div>
  );
}
