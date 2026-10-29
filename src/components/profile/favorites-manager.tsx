"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { FolderInput, Heart, LayoutGrid, List, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { createFavoriteFolder, deleteFavoriteFolder, moveFavorites, removeFavorites, renameFavoriteFolder, updateFavorite } from "@/lib/profiles/favorites-actions";
import { cn } from "@/lib/utils";
import { FolderBar, type Folder, type FolderFilter } from "./favorite-folders";
import { FavoriteCard, FavoriteEditDialog, FavoriteRow, TYPE_LABEL, type FavoriteItem } from "./favorite-views";

export type { FavoriteItem } from "./favorite-views";

type TypeFilter = "all" | FavoriteItem["accountType"];
const VIEW_KEY = "pp:favorites-view";

/** Ansicht (Raster/Liste) pro Browser merken. */
function readView(): "grid" | "list" {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}
function subscribeView(cb: () => void) {
  window.addEventListener(VIEW_KEY, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(VIEW_KEY, cb);
    window.removeEventListener("storage", cb);
  };
}

const pill = (active: boolean) =>
  cn(
    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:border-foreground",
    active ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
  );

/** Favoriten verwalten: Liste/Raster, Filter nach Kontotyp, Ordner, Notizen, Mehrfachauswahl. */
export function FavoritesManager({ initialItems, initialFolders }: { initialItems: FavoriteItem[]; initialFolders: Folder[] }) {
  const [items, setItems] = useState(initialItems);
  const [folders, setFolders] = useState(initialFolders);
  const [type, setType] = useState<TypeFilter>("all");
  const [folder, setFolder] = useState<FolderFilter>("all");
  const view = useSyncExternalStore(subscribeView, readView, () => "grid" as const);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<FavoriteItem | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [, start] = useTransition();
  const handleLocked = useLockedHandler();

  const fail = (res: { ok: boolean; code?: string; error?: string }) => {
    if (!handleLocked(res)) toast.error(res.error ?? "Fehler");
    return false;
  };

  const byType = items.filter((i) => type === "all" || i.accountType === type);
  const shown = byType.filter((i) => (folder === "all" ? true : folder === "none" ? !i.folderId : i.folderId === folder));
  const counts: Record<string, number> = { all: byType.length, none: byType.filter((i) => !i.folderId).length };
  for (const f of folders) counts[f.id] = byType.filter((i) => i.folderId === f.id).length;
  const typeCount = (t: TypeFilter) => (t === "all" ? items.length : items.filter((i) => i.accountType === t).length);
  const folderName = (id: string | null) => (id ? (folders.find((f) => f.id === id)?.name ?? null) : null);

  const setViewMode = (v: "grid" | "list") => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
    window.dispatchEvent(new Event(VIEW_KEY));
  };

  const patchItems = (ids: string[], patch: Partial<FavoriteItem>) => setItems((list) => list.map((i) => (ids.includes(i.id) ? { ...i, ...patch } : i)));

  const notify = (item: FavoriteItem, v: boolean) => {
    patchItems([item.id], { notify: v });
    start(async () => {
      const res = await updateFavorite(item.id, { notify: v });
      if (!res.ok) {
        patchItems([item.id], { notify: !v });
        fail(res);
      }
    });
  };

  const move = (ids: string[], folderId: string | null) =>
    start(async () => {
      const res = await moveFavorites(ids, folderId);
      if (!res.ok) return void fail(res);
      patchItems(ids, { folderId });
      setSelected([]);
      toast.success(folderId ? `In „${folderName(folderId)}“ verschoben` : "Aus Ordner entfernt");
    });

  const remove = (ids: string[]) =>
    start(async () => {
      const res = await removeFavorites(ids);
      if (!res.ok) return void fail(res);
      setItems((list) => list.filter((i) => !ids.includes(i.id)));
      setSelected((s) => s.filter((x) => !ids.includes(x)));
      setConfirm(null);
      toast.success(ids.length === 1 ? "Aus Favoriten entfernt" : `${ids.length} Favoriten entfernt`);
    });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allShownSelected = shown.length > 0 && shown.every((i) => selected.includes(i.id));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-14 text-center">
        <Heart className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Noch keine Favoriten. Tippe auf das Herz auf einem Profil, um es dir zu merken.</p>
        <Button size="sm" asChild>
          <Link href="/suche">Profile entdecken</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "escort", "club", "member"] as TypeFilter[]).map((t) => (
          <button key={t} type="button" className={pill(type === t)} onClick={() => setType(t)}>
            {t === "all" ? "Alle" : TYPE_LABEL[t]} <span className="opacity-70">{typeCount(t)}</span>
          </button>
        ))}
        <div className="ml-auto flex rounded-full border p-0.5" role="group" aria-label="Ansicht">
          <button type="button" aria-pressed={view === "grid"} aria-label="Raster" onClick={() => setViewMode("grid")} className={cn("rounded-full p-1.5", view === "grid" && "bg-foreground text-background")}>
            <LayoutGrid className="size-3.5" />
          </button>
          <button type="button" aria-pressed={view === "list"} aria-label="Liste" onClick={() => setViewMode("list")} className={cn("rounded-full p-1.5", view === "list" && "bg-foreground text-background")}>
            <List className="size-3.5" />
          </button>
        </div>
      </div>

      <FolderBar
        folders={folders}
        counts={counts}
        value={folder}
        onChange={setFolder}
        onCreate={async (name) => {
          const res = await createFavoriteFolder(name);
          if (!res.ok) return fail(res);
          setFolders((f) => [...f, res.data]);
          return true;
        }}
        onRename={async (id, name) => {
          const res = await renameFavoriteFolder(id, name);
          if (!res.ok) return fail(res);
          setFolders((f) => f.map((x) => (x.id === id ? res.data : x)));
          return true;
        }}
        onDelete={async (id) => {
          const res = await deleteFavoriteFolder(id);
          if (!res.ok) return fail(res);
          setFolders((f) => f.filter((x) => x.id !== id));
          setItems((list) => list.map((i) => (i.folderId === id ? { ...i, folderId: null } : i)));
          if (folder === id) setFolder("all");
          return true;
        }}
      />

      <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs">
        <button type="button" className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setSelected(allShownSelected ? [] : shown.map((i) => i.id))}>
          {allShownSelected ? "Auswahl aufheben" : "Alle auswählen"}
        </button>
        {selected.length > 0 && (
          <>
            <span className="font-semibold">{selected.length} ausgewählt</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="ml-auto">
                  <FolderInput /> Verschieben
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {folders.map((f) => (
                  <DropdownMenuItem key={f.id} onSelect={() => move(selected, f.id)}>
                    {f.name}
                  </DropdownMenuItem>
                ))}
                {folders.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => move(selected, null)}>Ohne Ordner</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="destructive" onClick={() => setConfirm(selected)}>
              <Trash2 /> Entfernen
            </Button>
          </>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">Keine Favoriten in dieser Auswahl.</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((i) => (
            <FavoriteCard
              key={i.id}
              item={i}
              selected={selected.includes(i.id)}
              onSelect={() => toggle(i.id)}
              onEdit={() => setEditing(i)}
              onNotify={(v) => notify(i, v)}
              onRemove={() => setConfirm([i.id])}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((i) => (
            <FavoriteRow
              key={i.id}
              item={i}
              folderName={folderName(i.folderId)}
              selected={selected.includes(i.id)}
              onSelect={() => toggle(i.id)}
              onEdit={() => setEditing(i)}
              onNotify={(v) => notify(i, v)}
              onRemove={() => setConfirm([i.id])}
            />
          ))}
        </div>
      )}

      <FavoriteEditDialog
        item={editing}
        folders={folders}
        onClose={() => setEditing(null)}
        onSave={async (p) => {
          if (!editing) return false;
          const res = await updateFavorite(editing.id, { note: p.note, notify: p.notify });
          if (!res.ok) return fail(res);
          if (p.folderId !== editing.folderId) {
            const m = await moveFavorites([editing.id], p.folderId);
            if (!m.ok) return fail(m);
          }
          patchItems([editing.id], p);
          toast.success("Gespeichert");
          return true;
        }}
      />

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm && confirm.length > 1 ? `${confirm.length} Favoriten entfernen?` : "Favorit entfernen?"}</DialogTitle>
            <DialogDescription>Notizen zu diesen Profilen werden ebenfalls gelöscht.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={() => confirm && remove(confirm)}>
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
