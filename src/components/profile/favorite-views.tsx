"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Bell, BellOff, Check, MapPin, MoreVertical, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/shared/select/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import type { Folder } from "./favorite-folders";

export type FavoriteItem = {
  id: string;
  name: string;
  href: string;
  accountType: "member" | "escort" | "club";
  avatarUrl: string | null;
  verified: boolean;
  online: boolean;
  city: string | null;
  age: number | null;
  folderId: string | null;
  note: string | null;
  notify: boolean;
  addedAt: string;
};

export const TYPE_LABEL = { escort: "Escort", club: "Club / Studio", member: "Mitglied" } as const;

type ItemProps = {
  item: FavoriteItem;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onNotify: (v: boolean) => void;
  onRemove: () => void;
  folderName?: string | null;
};

function SelectBox({ selected, onSelect, className }: { selected: boolean; onSelect: () => void; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label="Auswählen"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-primary bg-primary" : "border-white/70 bg-black/40", className)}
    >
      {selected && <Check className="size-3 text-white" />}
    </button>
  );
}

function ItemMenu({ item, onEdit, onNotify, onRemove }: Pick<ItemProps, "item" | "onEdit" | "onNotify" | "onRemove">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Aktionen" className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <NotebookPen /> Notiz & Ordner
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onNotify(!item.notify)}>
          {item.notify ? <BellOff /> : <Bell />} {item.notify ? "Nicht mehr benachrichtigen" : "Benachrichtigen"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2 /> Entfernen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FavoriteCard(p: ItemProps) {
  const { item } = p;
  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-lg border bg-card", p.selected && "border-primary")}>
      <Link href={item.href} className="relative block aspect-[3/4] bg-muted">
        {item.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.avatarUrl} alt={item.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-4xl font-bold text-muted-foreground">{item.name.slice(0, 1)}</span>
        )}
        {item.notify && (
          <span className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white" title="Benachrichtigung aktiv">
            <Bell className="size-3" />
          </span>
        )}
      </Link>
      <SelectBox selected={p.selected} onSelect={p.onSelect} className="absolute top-2 left-2" />
      <div className="flex items-start gap-1 p-2.5">
        <div className="min-w-0 flex-1">
          <Link href={item.href} className="flex items-center gap-1 text-sm font-semibold">
            <span className="truncate">{item.name}</span>
            {item.age && <span className="font-normal text-muted-foreground">{item.age}</span>}
            {item.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" />}
          </Link>
          <p className="truncate text-[11px] text-muted-foreground">
            {TYPE_LABEL[item.accountType]}
            {item.city ? ` · ${item.city}` : ""}
          </p>
          {item.note && <p className="mt-1 line-clamp-2 text-[11px] text-foreground/80 italic">{item.note}</p>}
        </div>
        <ItemMenu {...p} />
      </div>
    </div>
  );
}

export function FavoriteRow(p: ItemProps) {
  const { item } = p;
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-card p-3", p.selected && "border-primary")}>
      <SelectBox selected={p.selected} onSelect={p.onSelect} className="border-border bg-transparent" />
      <UserAvatar user={{ name: item.name, avatarUrl: item.avatarUrl, href: item.href, online: item.online }} size="md" link />
      <div className="min-w-0 flex-1">
        <Link href={item.href} className="flex items-center gap-1 text-sm font-semibold hover:underline">
          <span className="truncate">{item.name}</span>
          {item.age && <span className="font-normal text-muted-foreground">{item.age}</span>}
          {item.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" />}
        </Link>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          {TYPE_LABEL[item.accountType]}
          {item.city && (
            <>
              <MapPin className="ml-1 size-3" /> {item.city}
            </>
          )}
          {p.folderName && <span className="ml-1 rounded-full bg-secondary px-1.5">{p.folderName}</span>}
        </p>
        <button type="button" onClick={p.onEdit} className="mt-0.5 block max-w-full truncate text-left text-[11px] text-foreground/80 italic hover:text-foreground">
          {item.note || <span className="text-muted-foreground not-italic">+ Notiz hinzufügen</span>}
        </button>
      </div>
      <label className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
        <Bell className="size-3.5" /> Benachrichtigen
        <Switch checked={item.notify} onCheckedChange={p.onNotify} aria-label={`Benachrichtigen für ${item.name}`} />
      </label>
      <ItemMenu {...p} />
    </div>
  );
}

/** Notiz, Ordner und Benachrichtigung eines Favoriten bearbeiten. */
export function FavoriteEditDialog({
  item,
  folders,
  onClose,
  onSave,
}: {
  item: FavoriteItem | null;
  folders: Folder[];
  onClose: () => void;
  onSave: (patch: { note: string | null; notify: boolean; folderId: string | null }) => Promise<boolean>;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{item && <EditForm key={item.id} item={item} folders={folders} onClose={onClose} onSave={onSave} />}</DialogContent>
    </Dialog>
  );
}

function EditForm({ item, folders, onClose, onSave }: { item: FavoriteItem; folders: Folder[]; onClose: () => void; onSave: (patch: { note: string | null; notify: boolean; folderId: string | null }) => Promise<boolean> }) {
  const [note, setNote] = useState(item.note ?? "");
  const [notify, setNotify] = useState(item.notify);
  const [folderId, setFolderId] = useState(item.folderId);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{item.name}</DialogTitle>
        <DialogDescription>Die Notiz ist privat und nur für dich sichtbar.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fav-note" className="text-xs text-muted-foreground">
            Private Notiz
          </Label>
          <Textarea id="fav-note" value={note} maxLength={1000} rows={4} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Lieblings-Location, nächstes Date …" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Ordner</Label>
          <Select
            options={[{ value: "__none", label: "Ohne Ordner" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
            value={folderId ?? "__none"}
            onChange={(v) => setFolderId(!v || v === "__none" ? null : v)}
            aria-label="Ordner"
          />
        </div>
        <label className="flex items-start justify-between gap-3 rounded-md border p-3">
          <span>
            <span className="block text-sm font-semibold">Benachrichtigen</span>
            <span className="block text-xs text-muted-foreground">Bei neuer Story, neuem Standort oder neuen freien Terminen.</span>
          </span>
          <Switch checked={notify} onCheckedChange={setNotify} aria-label="Benachrichtigen" />
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onSave({ note: note.trim() || null, notify, folderId });
            setBusy(false);
            if (ok) onClose();
          }}
        >
          Speichern
        </Button>
      </DialogFooter>
    </>
  );
}
