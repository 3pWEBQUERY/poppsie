"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, FolderInput, Lock, LockOpen, Pencil, PenSquare, Pin, PinOff, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ShareButton } from "@/components/content/share-dialog";
import { useContentViewer } from "@/components/content/viewer-context";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editThread, moderateThread, toggleSubscription } from "@/lib/forum/actions";
import { THREAD_PREFIXES } from "@/lib/forum/types";
import { ThreadBadges } from "./thread-list";

type Thread = { id: string; title: string; prefix: string | null; tags: string[]; pinned: boolean; locked: boolean; solved: boolean; authorId: string; viewCount: number; replyCount: number };

/** Kopf eines Themas: Titel, "Beitrag schreiben", "Beobachten", Teilen, Moderation. */
export function ThreadHeader({
  thread,
  subscribed: initialSub,
  moderator,
  canReply,
  moveTargets,
  unreadHref,
}: {
  thread: Thread;
  subscribed: boolean;
  moderator: boolean;
  canReply: boolean;
  moveTargets: { value: string; label: string; group?: string }[];
  unreadHref: string | null;
}) {
  const viewer = useContentViewer();
  const router = useRouter();
  const locked = useLockedHandler();
  const [sub, setSub] = useState(initialSub);
  const [pending, start] = useTransition();
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const [prefix, setPrefix] = useState<string | null>(thread.prefix);
  const [tags, setTags] = useState(thread.tags.join(", "));
  const isAuthor = viewer?.id === thread.authorId;

  const mod = (action: Parameters<typeof moderateThread>[0]["action"], categoryId?: string) =>
    start(async () => {
      const res = await moderateThread({ threadId: thread.id, action, categoryId });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      if (res.data.deleted) {
        toast.success("Thema gelöscht");
        router.push(`/forum/${res.data.categorySlug}`);
        return;
      }
      setMoveOpen(false);
      router.refresh();
    });

  const saveEdit = () =>
    start(async () => {
      const res = await editThread({ threadId: thread.id, title, prefix: (prefix as (typeof THREAD_PREFIXES)[number]) || null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      setEditOpen(false);
      router.refresh();
    });

  return (
    <header className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h1 className="text-xl leading-tight font-extrabold sm:text-2xl">
        <ThreadBadges t={thread} className="mr-2" />
        {thread.title}
      </h1>
      {thread.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {thread.tags.map((t) => (
            <Link key={t} href={`/forum?tag=${encodeURIComponent(t)}`} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] hover:bg-accent">
              #{t}
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {canReply && (
          <Button asChild>
            <a href="#antworten">
              <PenSquare /> Beitrag schreiben
            </a>
          </Button>
        )}
        {viewer && (
          <Button
            variant="outline"
            disabled={pending}
            aria-pressed={sub}
            onClick={() =>
              start(async () => {
                const res = await toggleSubscription(thread.id);
                if (!res.ok) {
                  if (!locked(res)) toast.error(res.error);
                  return;
                }
                setSub(res.data.subscribed);
                toast.success(res.data.subscribed ? "Du wirst bei neuen Antworten benachrichtigt" : "Beobachtung beendet");
              })
            }
          >
            {sub ? <EyeOff /> : <Eye />} {sub ? "Nicht mehr beobachten" : "Beobachten"}
          </Button>
        )}
        {viewer && <ShareButton embed={{ type: "thread", id: thread.id }} label="Teilen in…" variant="outline" className="h-9 text-foreground" />}
        {unreadHref && (
          <Button asChild variant="ghost" size="sm">
            <Link href={unreadHref}>Zum ersten ungelesenen Beitrag</Link>
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {thread.replyCount} Antworten · {thread.viewCount} Aufrufe
        </span>
        {(isAuthor || moderator) && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Themen-Werkzeuge">
                <Shield /> {moderator ? "Moderation" : "Thema"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil /> Titel & Tags bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => mod(thread.solved ? "unsolve" : "solve")}>
                <CheckCircle2 /> {thread.solved ? "Nicht mehr gelöst" : "Als gelöst markieren"}
              </DropdownMenuItem>
              {moderator && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Moderation</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => mod(thread.pinned ? "unpin" : "pin")}>
                    {thread.pinned ? <PinOff /> : <Pin />} {thread.pinned ? "Lösen" : "Anpinnen"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => mod(thread.locked ? "unlock" : "lock")}>
                    {thread.locked ? <LockOpen /> : <Lock />} {thread.locked ? "Öffnen" : "Schliessen"}
                  </DropdownMenuItem>
                  {moveTargets.length > 0 && (
                    <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
                      <FolderInput /> Verschieben
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => confirm("Thema mit allen Beiträgen löschen?") && mod("delete")} className="text-destructive focus:text-destructive">
                    <Trash2 /> Thema löschen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thema verschieben</DialogTitle>
          </DialogHeader>
          <Select options={moveTargets} value={target} onChange={setTarget} placeholder="Ziel-Kategorie wählen" searchable aria-label="Ziel-Kategorie" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Abbrechen
            </Button>
            <Button disabled={!target || pending} onClick={() => target && mod("move", target)}>
              Verschieben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thema bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="th-title">Titel</Label>
            <Input id="th-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Präfix</Label>
            <Select options={THREAD_PREFIXES.map((p) => ({ value: p, label: p }))} value={prefix} onChange={setPrefix} clearable placeholder="Kein Präfix" aria-label="Präfix" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="th-tags">Tags (mit Komma getrennt, max. 5)</Label>
            <Input id="th-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveEdit} disabled={pending || title.trim().length < 5}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
