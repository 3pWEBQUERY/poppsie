"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, EyeOff, GripVertical, ImagePlus, Loader2, MoreVertical, Trash2, UserRound, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { uploadFile, videoDuration } from "@/components/shared/media-uploader";
import { BlurSwitch } from "@/components/profile-wizard/media-step";
import { assignMediaSlot, deleteProfileMedia, reorderGallery, setGlobalBlur, setMediaBlur } from "@/lib/profiles/actions";
import type { MediaItem } from "@/lib/profiles/types";
import { cn } from "@/lib/utils";

const MAX = 50;

type Props = { initial: MediaItem[]; avatarId: string | null; coverId: string | null; blurForGuests: boolean; accountType: "escort" | "club" };

/** Galerie verwalten: Upload, Reihenfolge (Drag & Drop / Pfeile), Blur pro Medium und global, Löschen, als Profil-/Titelbild. */
export function GalleryManager({ initial, avatarId: initialAvatar, coverId: initialCover, blurForGuests, accountType }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [avatarId, setAvatarId] = useState(initialAvatar);
  const [coverId, setCoverId] = useState(initialCover);
  const [globalBlur, setGlobal] = useState(blurForGuests);
  const [uploads, setUploads] = useState<{ key: string; name: string; progress: number }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(items);

  const commit = (next: MediaItem[]) => {
    latest.current = next;
    setItems(next);
  };

  const persistOrder = (next: MediaItem[]) => {
    commit(next);
    start(async () => {
      const res = await reorderGallery(next.map((m) => m.id));
      if (!res.ok) toast.error(res.error);
    });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    persistOrder(next);
  };

  const onFiles = async (files: FileList) => {
    const list = Array.from(files).slice(0, Math.max(0, MAX - items.length - uploads.length));
    if (!list.length) return toast.error(`Maximal ${MAX} Medien in der Galerie`);
    await Promise.all(
      list.map(async (file) => {
        const key = `${file.name}-${Math.random()}`;
        setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
        try {
          const durationSec = file.type.startsWith("video/") ? await videoDuration(file) : undefined;
          const m = await uploadFile(file, "gallery", {
            blurForGuests: globalBlur,
            durationSec,
            onProgress: (progress) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x))),
          });
          commit([...latest.current, m]);
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setUploads((u) => u.filter((x) => x.key !== key));
        }
      }),
    );
    const res = await reorderGallery(latest.current.map((m) => m.id));
    if (!res.ok) toast.error(res.error);
    router.refresh();
  };

  const toggleBlur = (m: MediaItem) => {
    const blur = !m.blurForGuests;
    commit(items.map((x) => (x.id === m.id ? { ...x, blurForGuests: blur } : x)));
    start(async () => {
      const res = await setMediaBlur(m.id, blur);
      if (!res.ok) toast.error(res.error);
    });
  };

  const toggleGlobal = (blur: boolean) =>
    start(async () => {
      const res = await setGlobalBlur(blur, true);
      if (!res.ok) return void toast.error(res.error);
      setGlobal(blur);
      commit(items.map((x) => ({ ...x, blurForGuests: blur })));
      toast.success(blur ? "Alle Medien sind für Gäste unkenntlich" : "Alle Medien sind für Gäste sichtbar");
    });

  const assign = (id: string, slot: "avatar" | "cover") =>
    start(async () => {
      const res = await assignMediaSlot(id, slot);
      if (!res.ok) return void toast.error(res.error);
      if (slot === "avatar") setAvatarId(id);
      else setCoverId(id);
      toast.success(slot === "avatar" ? "Als Profilbild gesetzt" : "Als Titelbild gesetzt");
      router.refresh();
    });

  const remove = (ids: string[]) =>
    start(async () => {
      const res = await deleteProfileMedia(ids);
      if (!res.ok) return void toast.error(res.error);
      commit(items.filter((m) => !ids.includes(m.id)));
      if (avatarId && ids.includes(avatarId)) setAvatarId(null);
      if (coverId && ids.includes(coverId)) setCoverId(null);
      setSelected([]);
      setConfirm(null);
      toast.success(ids.length === 1 ? "Medium gelöscht" : `${ids.length} Medien gelöscht`);
      router.refresh();
    });

  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-5">
      <BlurSwitch checked={globalBlur} onChange={toggleGlobal} disabled={pending} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => input.current?.click()} disabled={items.length + uploads.length >= MAX}>
          <ImagePlus /> Hochladen
        </Button>
        <span className="text-xs text-muted-foreground">
          {items.length}/{MAX} Medien · Bilder bis 25 MB, Videos bis 60 Sekunden · Ziehen zum Sortieren
        </span>
        {selected.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs">{selected.length} ausgewählt</span>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Abbrechen
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirm(selected)}>
              <Trash2 /> Löschen
            </Button>
          </div>
        )}
        <input ref={input} type="file" hidden multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(e) => e.target.files && void onFiles(e.target.files)} />
      </div>

      {items.length === 0 && uploads.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-16 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          <ImagePlus className="size-8" /> Noch keine Medien. Lade deine ersten Bilder hoch.
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((m, i) => {
            const isSel = selected.includes(m.id);
            return (
              <li
                key={m.id}
                draggable
                onDragStart={() => setDragId(m.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = items.findIndex((x) => x.id === dragId);
                  if (from >= 0) move(from, i);
                  setDragId(null);
                }}
                className={cn("group relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted", dragId === m.id && "opacity-40", isSel && "border-primary ring-2 ring-primary")}
              >
                {m.kind === "video" ? (
                  <video src={m.url} muted preload="metadata" className="size-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbUrl} alt="" className="size-full object-cover" draggable={false} />
                )}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-1.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSel}
                    aria-label="Auswählen"
                    onClick={() => toggleSelect(m.id)}
                    className={cn("flex size-6 items-center justify-center rounded-full border-2 border-white/80", isSel ? "bg-primary" : "bg-black/40")}
                  >
                    {isSel && <Check className="size-3.5 text-white" />}
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-pressed={m.blurForGuests}
                      aria-label="Für Gäste unkenntlich machen"
                      title="Für Gäste unkenntlich machen"
                      onClick={() => toggleBlur(m)}
                      className={cn("rounded-full p-1.5", m.blurForGuests ? "bg-primary text-white" : "bg-black/50 text-white")}
                    >
                      <EyeOff className="size-3.5" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label="Aktionen" className="rounded-full bg-black/50 p-1.5 text-white">
                          <MoreVertical className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.kind === "image" && (
                          <>
                            <DropdownMenuItem onSelect={() => assign(m.id, "avatar")}>
                              <UserRound /> Als Profilbild verwenden
                            </DropdownMenuItem>
                            {accountType === "club" && (
                              <DropdownMenuItem onSelect={() => assign(m.id, "cover")}>
                                <ImageIcon /> Als Titelbild verwenden
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem variant="destructive" onSelect={() => setConfirm([m.id])}>
                          <Trash2 /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 p-1.5">
                  <div className="flex flex-wrap gap-1">
                    {i === 0 && <Badge className="px-2 text-[10px]">Erstes Bild</Badge>}
                    {m.id === avatarId && <Badge variant="secondary" className="px-2 text-[10px]">Profilbild</Badge>}
                    {m.id === coverId && <Badge variant="secondary" className="px-2 text-[10px]">Titelbild</Badge>}
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" aria-label="Nach vorne" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded-full bg-black/60 p-1.5 text-white disabled:opacity-30">
                      <ArrowLeft className="size-3.5" />
                    </button>
                    <span aria-hidden className="hidden cursor-grab rounded-full bg-black/60 p-1.5 text-white sm:inline-flex">
                      <GripVertical className="size-3.5" />
                    </span>
                    <button
                      type="button"
                      aria-label="Nach hinten"
                      disabled={i === items.length - 1}
                      onClick={() => move(i, i + 1)}
                      className="rounded-full bg-black/60 p-1.5 text-white disabled:opacity-30"
                    >
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {uploads.map((u) => (
            <li key={u.key} className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border bg-muted p-3">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <Progress value={u.progress} />
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">{u.name}</span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm && confirm.length > 1 ? `${confirm.length} Medien löschen?` : "Medium löschen?"}</DialogTitle>
            <DialogDescription>Die Dateien werden endgültig von unseren Servern entfernt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => confirm && remove(confirm)}>
              {pending && <Loader2 className="animate-spin" />} Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
