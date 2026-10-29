"use client";

import { useState } from "react";
import { FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Folder = { id: string; name: string };
export type FolderFilter = "all" | "none" | string;

const pill = (active: boolean) =>
  cn(
    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:border-foreground",
    active ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
  );

/** Ordner-Leiste: Filter, neuer Ordner, umbenennen und löschen. */
export function FolderBar({
  folders,
  counts,
  value,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: Folder[];
  counts: Record<string, number>;
  value: FolderFilter;
  onChange: (v: FolderFilter) => void;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [dialog, setDialog] = useState<{ mode: "create" | "rename" | "delete"; folder?: Folder } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!dialog) return;
    setBusy(true);
    const ok =
      dialog.mode === "create" ? await onCreate(name) : dialog.mode === "rename" ? await onRename(dialog.folder!.id, name) : await onDelete(dialog.folder!.id);
    setBusy(false);
    if (ok) setDialog(null);
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
      <button type="button" className={pill(value === "all")} onClick={() => onChange("all")}>
        Alle Ordner <span className="opacity-70">{counts.all ?? 0}</span>
      </button>
      <button type="button" className={pill(value === "none")} onClick={() => onChange("none")}>
        Ohne Ordner <span className="opacity-70">{counts.none ?? 0}</span>
      </button>
      {folders.map((f) => (
        <span key={f.id} className={cn(pill(value === f.id), "pr-1")}>
          <button type="button" onClick={() => onChange(f.id)} className="inline-flex items-center gap-1.5">
            {f.name} <span className="opacity-70">{counts[f.id] ?? 0}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Ordner ${f.name} bearbeiten`} className="rounded-full p-0.5 hover:bg-background/20">
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => {
                  setName(f.name);
                  setDialog({ mode: "rename", folder: f });
                }}
              >
                <Pencil /> Umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ mode: "delete", folder: f })}>
                <Trash2 /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ))}
      <button
        type="button"
        className={cn(pill(false), "border-dashed")}
        onClick={() => {
          setName("");
          setDialog({ mode: "create" });
        }}
      >
        <FolderPlus className="size-3.5" /> Neuer Ordner
      </button>

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "Neuer Ordner" : dialog?.mode === "rename" ? "Ordner umbenennen" : `Ordner „${dialog?.folder?.name}“ löschen?`}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "delete" ? "Die Favoriten bleiben erhalten und landen unter „Ohne Ordner“." : "Zum Beispiel „Zürich“ oder „Später“."}
            </DialogDescription>
          </DialogHeader>
          {dialog?.mode !== "delete" && (
            <Input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Ordnername"
              aria-label="Ordnername"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button variant={dialog?.mode === "delete" ? "destructive" : "default"} disabled={busy || (dialog?.mode !== "delete" && !name.trim())} onClick={() => void submit()}>
              {dialog?.mode === "delete" ? "Löschen" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
