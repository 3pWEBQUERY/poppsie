"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MultiSelect, Select } from "@/components/shared/select/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveForumCategory } from "@/lib/admin/actions/config";

export type CategoryValue = {
  id?: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  readTypes: ("member" | "escort" | "club")[];
  writeTypes: ("member" | "escort" | "club")[];
  adultOnlyMedia: boolean;
};

const TYPES = [
  { value: "member", label: "Mitglieder" },
  { value: "escort", label: "Escorts" },
  { value: "club", label: "Clubs / Studios" },
];

export function ForumCategoryDialog({
  trigger,
  initial,
  parents,
  hasChildren = false,
}: {
  trigger: React.ReactNode;
  initial: CategoryValue;
  parents: { id: string; name: string }[];
  hasChildren?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof CategoryValue>(k: K, val: CategoryValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const parentOptions = parents.filter((p) => p.id !== initial.id).map((p) => ({ value: p.id, label: p.name }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setV(initial);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Kategorie bearbeiten" : v.parentId ? "Neues Unterforum" : "Neue Kategorie"}</DialogTitle>
          <DialogDescription>Leere Rechte-Auswahl bedeutet: alle Kontotypen.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveForumCategory({ ...v, slug: v.slug || undefined, description: v.description || undefined });
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Kategorie gespeichert");
                setOpen(false);
                router.refresh();
              }
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" required minLength={2} maxLength={80} value={v.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug">Slug (URL)</Label>
              <Input id="cat-slug" maxLength={60} value={v.slug} placeholder="automatisch aus dem Namen" onChange={(e) => set("slug", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-desc">Beschreibung</Label>
            <Textarea id="cat-desc" rows={2} maxLength={500} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="flex flex-col gap-1.5">
              <Label>Oberkategorie</Label>
              <Select
                aria-label="Oberkategorie"
                options={parentOptions}
                value={v.parentId}
                disabled={hasChildren}
                clearable
                placeholder="Keine (Hauptkategorie)"
                onChange={(p) => set("parentId", p)}
              />
              {hasChildren && <p className="text-[11px] text-muted-foreground">Hat Unterforen und bleibt deshalb Hauptkategorie.</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-sort">Reihenfolge</Label>
              <Input id="cat-sort" type="number" min={0} max={9999} value={v.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Lesen</Label>
              <MultiSelect aria-label="Leserechte" options={TYPES} value={v.readTypes} placeholder="Alle" onChange={(x) => set("readTypes", x as CategoryValue["readTypes"])} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Schreiben</Label>
              <MultiSelect aria-label="Schreibrechte" options={TYPES} value={v.writeTypes} placeholder="Alle" onChange={(x) => set("writeTypes", x as CategoryValue["writeTypes"])} />
            </div>
          </div>
          <Label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 font-normal">
            <span>
              <span className="block text-sm font-semibold">Medien für Erwachsene (18+)</span>
              <span className="block text-xs text-muted-foreground">Kategorie erlaubt Bilder und Videos mit expliziten Inhalten.</span>
            </span>
            <Switch checked={v.adultOnlyMedia} onCheckedChange={(c) => set("adultOnlyMedia", c)} />
          </Label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
