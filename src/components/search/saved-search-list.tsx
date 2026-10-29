"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellOff, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSavedSearch, renameSavedSearch, setSavedSearchNotify } from "@/app/(site)/dashboard/suchen/actions";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type SavedSearchItem = {
  id: string;
  name: string;
  href: string;
  chips: string[];
  kind: "escort" | "club";
  notify: boolean;
  createdAt: string;
  matches: number;
};

type Res = { ok: boolean; code?: string; error?: string };

function Row({ s }: { s: SavedSearchItem }) {
  const [notify, setNotify] = useState(s.notify);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(s.name);
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const done = (res: Res, ok?: string) => {
    if (res.ok) {
      if (ok) toast.success(ok);
      return true;
    }
    if (!handleLocked(res)) toast.error(res.error);
    return false;
  };

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={s.href} className="truncate font-display font-semibold hover:underline">
            {s.name}
          </Link>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{s.kind === "club" ? "Clubs & Studios" : "Escorts"}</span>
          <span className="text-xs text-muted-foreground">
            {s.matches} aktuelle Treffer · gespeichert am {s.createdAt}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {s.chips.length ? (
            s.chips.map((c) => (
              <span key={c} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                {c}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Keine Filter</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <label className="mr-2 flex items-center gap-2 text-xs text-muted-foreground" title="Bei neuen Treffern benachrichtigen">
          {notify ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
          <Switch
            checked={notify}
            disabled={pending}
            aria-label="Benachrichtigung bei neuen Treffern"
            onCheckedChange={(v) =>
              start(async () => {
                setNotify(v);
                if (!done(await setSavedSearchNotify(s.id, v), v ? "Benachrichtigung eingeschaltet" : "Benachrichtigung ausgeschaltet")) setNotify(!v);
              })
            }
          />
        </label>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={s.href} aria-label="Suche öffnen" title="Öffnen">
            <ExternalLink />
          </Link>
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Umbenennen" title="Umbenennen" onClick={() => setRenaming(true)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Löschen" title="Löschen" onClick={() => setDeleting(true)}>
          <Trash2 />
        </Button>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suche umbenennen</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                if (done(await renameSavedSearch(s.id, name), "Gespeichert")) setRenaming(false);
              });
            }}
          >
            <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Name" autoFocus />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suche löschen?</DialogTitle>
            <DialogDescription>„{s.name}“ wird entfernt. Du erhältst dafür keine Benachrichtigungen mehr.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (done(await deleteSavedSearch(s.id), "Suche gelöscht")) setDeleting(false);
                })
              }
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function SavedSearchList({ items }: { items: SavedSearchItem[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-card">
      {items.map((s) => (
        <Row key={s.id} s={s} />
      ))}
    </ul>
  );
}
