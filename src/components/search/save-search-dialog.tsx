"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { saveSearch } from "@/app/(site)/suche/actions";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toQueryRecord, type SearchFilters } from "@/lib/search/filters";

/** "Suche speichern" (nur eingeloggt): Name + Benachrichtigung bei neuen Treffern. */
export function SaveSearchButton({ filters, suggestedName, loggedIn }: { filters: SearchFilters; suggestedName: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [notify, setNotify] = useState(true);
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const router = useRouter();

  if (!loggedIn) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/anmelden?next=${encodeURIComponent("/suche")}`} aria-label="Suche speichern">
          <Bookmark /> <span className="hidden sm:inline">Suche speichern</span>
        </Link>
      </Button>
    );
  }

  const submit = () =>
    start(async () => {
      const res = await saveSearch({ name, notify, query: toQueryRecord(filters) });
      if (res.ok) {
        setOpen(false);
        toast.success("Suche gespeichert", { action: { label: "Ansehen", onClick: () => router.push("/dashboard/suchen") } });
      } else if (!handleLocked(res)) toast.error(res.error);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setName(suggestedName);
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Suche speichern">
          <Bookmark /> <span className="hidden sm:inline">Suche speichern</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suche speichern</DialogTitle>
          <DialogDescription>Du findest deine gespeicherten Suchen in deinem Bereich unter „Gespeicherte Suchen“.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="saved-search-name">Name</Label>
            <Input id="saved-search-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Bei neuen Treffern benachrichtigen</span>
              <span className="text-xs text-muted-foreground">Wir prüfen stündlich, ob neue Profile passen.</span>
            </span>
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="Benachrichtigen" />
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
