"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Loader2, Search, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { removeLink, requestLink, respondLink, searchLinkTargets, setPresentToday, type LinkCandidate } from "@/lib/profiles/link-actions";

export type LinkEntry = {
  id: string;
  name: string;
  href: string;
  avatarUrl: string | null;
  verified: boolean;
  status: "pending" | "accepted" | "rejected";
  incoming: boolean;
  presentToday: boolean;
};

function Person({ e, children }: { e: Pick<LinkEntry, "name" | "href" | "avatarUrl" | "verified">; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <UserAvatar user={{ name: e.name, avatarUrl: e.avatarUrl, href: e.href }} size="md" link />
      <Link href={e.href} className="flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold hover:underline">
        <span className="truncate">{e.name}</span>
        {e.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" />}
      </Link>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** Line-up & Clubs: suchen, anfragen/einladen, annehmen/ablehnen, entfernen, "heute anwesend". */
export function LinksManager({ initial, accountType }: { initial: LinkEntry[]; accountType: "escort" | "club" }) {
  const [links, setLinks] = useState(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LinkCandidate[] | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const handleLocked = useLockedHandler();
  const club = accountType === "club";

  const fail = (res: { ok: boolean; code?: string; error?: string }) => {
    if (!handleLocked(res)) toast.error(res.error ?? "Fehler");
  };

  const search = () =>
    start(async () => {
      const res = await searchLinkTargets(q);
      if (!res.ok) return fail(res);
      setResults(res.data);
    });

  const act = (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    start(async () => {
      await fn();
      setBusyId(null);
    });
  };

  const request = (c: LinkCandidate) =>
    act(c.id, async () => {
      const res = await requestLink(c.id);
      if (!res.ok) return fail(res);
      const status = res.data.status;
      setResults((r) => r?.map((x) => (x.id === c.id ? { ...x, status } : x)) ?? null);
      setLinks((l) => [
        ...l.filter((x) => x.id !== c.id),
        { id: c.id, name: c.name, href: c.href, avatarUrl: c.avatarUrl, verified: c.verified, status, incoming: false, presentToday: false },
      ]);
      toast.success(status === "accepted" ? "Verknüpfung bestätigt" : club ? "Einladung gesendet" : "Anfrage gesendet");
    });

  const respond = (e: LinkEntry, accept: boolean) =>
    act(e.id, async () => {
      const res = await respondLink(e.id, accept);
      if (!res.ok) return fail(res);
      setLinks((l) => (accept ? l.map((x) => (x.id === e.id ? { ...x, status: "accepted" } : x)) : l.filter((x) => x.id !== e.id)));
    });

  const remove = (e: LinkEntry) =>
    act(e.id, async () => {
      const res = await removeLink(e.id);
      if (!res.ok) return fail(res);
      setLinks((l) => l.filter((x) => x.id !== e.id));
      setResults((r) => r?.map((x) => (x.id === e.id ? { ...x, status: null } : x)) ?? null);
    });

  const present = (e: LinkEntry, v: boolean) => {
    setLinks((l) => l.map((x) => (x.id === e.id ? { ...x, presentToday: v } : x)));
    start(async () => {
      const res = await setPresentToday(e.id, v);
      if (!res.ok) {
        setLinks((l) => l.map((x) => (x.id === e.id ? { ...x, presentToday: !v } : x)));
        fail(res);
      }
    });
  };

  const incoming = links.filter((l) => l.status === "pending" && l.incoming);
  const outgoing = links.filter((l) => l.status === "pending" && !l.incoming);
  const accepted = links.filter((l) => l.status === "accepted");
  const presentCount = accepted.filter((l) => l.presentToday).length;
  const spinner = (id: string) => (pending && busyId === id ? <Loader2 className="animate-spin" /> : null);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-bold">{club ? "Girl einladen" : "Mit einem Club verknüpfen"}</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim().length >= 2) search();
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={club ? "Benutzername oder Name" : "Name des Clubs oder Studios"} aria-label="Suchen" className="pl-9" />
          </div>
          <Button type="submit" disabled={q.trim().length < 2 || pending}>
            Suchen
          </Button>
        </form>
        {results && (
          <div className="flex flex-col gap-2">
            {results.length === 0 && <p className="text-xs text-muted-foreground">Keine verifizierten Profile gefunden.</p>}
            {results.map((c) => (
              <Person key={c.id} e={c}>
                {c.status === "accepted" ? (
                  <Badge variant="success">Verknüpft</Badge>
                ) : c.status === "pending" ? (
                  <Badge variant="warning">Angefragt</Badge>
                ) : (
                  <Button size="sm" onClick={() => request(c)} disabled={pending}>
                    {spinner(c.id) ?? <Send />} {club ? "Einladen" : "Anfrage senden"}
                  </Button>
                )}
              </Person>
            ))}
          </div>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">{club ? "Anfragen von Girls" : "Einladungen von Clubs"}</h2>
          {incoming.map((e) => (
            <Person key={e.id} e={e}>
              <Button size="sm" onClick={() => respond(e, true)} disabled={pending}>
                {spinner(e.id) ?? <Check />} Annehmen
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond(e, false)} disabled={pending}>
                <X /> Ablehnen
              </Button>
            </Person>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{club ? `Line-up (${accepted.length})` : `Meine Clubs (${accepted.length})`}</h2>
          {club && presentCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-success">
              <Sparkles className="size-3.5" /> {presentCount} heute anwesend
            </span>
          )}
        </div>
        {accepted.length === 0 && (
          <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {club ? "Noch keine Girls im Line-up. Lade Girls über die Suche ein." : "Noch mit keinem Club verknüpft."}
          </p>
        )}
        {accepted.map((e) => (
          <Person key={e.id} e={e}>
            {club ? (
              <label className="flex items-center gap-2 text-xs">
                <span className={e.presentToday ? "font-semibold text-success" : "text-muted-foreground"}>Heute anwesend</span>
                <Switch checked={e.presentToday} onCheckedChange={(v) => present(e, v)} aria-label={`${e.name} heute anwesend`} />
              </label>
            ) : (
              e.presentToday && <Badge variant="success">Heute anwesend</Badge>
            )}
            <Button size="sm" variant="ghost" onClick={() => remove(e)} disabled={pending} aria-label={`Verknüpfung mit ${e.name} entfernen`}>
              {spinner(e.id) ?? <X />} Entfernen
            </Button>
          </Person>
        ))}
      </section>

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Gesendete Anfragen</h2>
          {outgoing.map((e) => (
            <Person key={e.id} e={e}>
              <Badge variant="warning">Ausstehend</Badge>
              <Button size="sm" variant="ghost" onClick={() => remove(e)} disabled={pending}>
                Zurückziehen
              </Button>
            </Person>
          ))}
        </section>
      )}
    </div>
  );
}
