"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { myShareTargets, previewEmbed, shareTo } from "@/lib/content/actions";
import type { EmbedPreview, EmbedRef } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { EmbedCard } from "./embed-card";

/** Dialog "Teilen in…": Einbettung in den eigenen Feed oder eine Gruppe teilen. */
export function ShareDialog({ embed, open, onOpenChange }: { embed: EmbedRef; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [targets, setTargets] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState<string>("feed");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<EmbedPreview | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const locked = useLockedHandler();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    myShareTargets().then((r) => {
      if (!alive) return;
      if (r.ok) setTargets(r.data);
      else locked(r);
    });
    previewEmbed(embed).then((r) => alive && setPreview(r.ok ? r.data : null));
    return () => {
      alive = false;
    };
  }, [open, embed, locked]);

  const submit = () =>
    start(async () => {
      const res = await shareTo({ target, embed, body: text });
      if (!res.ok) {
        if (!locked(res)) toast.error(res.error);
        return;
      }
      toast.success(target === "feed" ? "Im Newsfeed geteilt" : "In der Gruppe geteilt");
      setText("");
      onOpenChange(false);
    });

  const options = [{ value: "feed", label: "Mein Newsfeed" }, ...targets.map((t) => ({ value: t.id, label: t.name, group: "Gruppen" }))];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Teilen in…</DialogTitle>
          <DialogDescription>Der Inhalt wird als Vorschaukarte eingebettet, das Original bleibt verlinkt.</DialogDescription>
        </DialogHeader>
        <Select options={options} value={target} onChange={(v) => setTarget(v ?? "feed")} aria-label="Ziel" searchable={options.length > 8} />
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Schreib etwas dazu (optional)" maxLength={2000} rows={3} />
        {preview === undefined ? (
          <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
        ) : preview ? (
          <EmbedCard e={preview} />
        ) : (
          <p className="text-xs text-muted-foreground">Vorschau nicht verfügbar.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || preview === null}>
            {pending && <Loader2 className="animate-spin" />} Teilen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Button "Teilen in…" für Threads, Profile, Gruppen, Posts und Highlights. */
export function ShareButton({ embed, label = "Teilen", className, variant = "ghost" }: { embed: EmbedRef; label?: string; className?: string; variant?: "ghost" | "outline" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)} className={cn("text-muted-foreground", className)}>
        <Share2 /> {label}
      </Button>
      {open && <ShareDialog embed={embed} open={open} onOpenChange={setOpen} />}
    </>
  );
}
