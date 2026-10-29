"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Heart, Loader2, MessageCircle, Play, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/content/relative-time";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { REACTIONS } from "@/lib/content/types";
import { deleteStory, setStoryHighlight, storyViewers } from "@/lib/stories/actions";
import type { ManagedStory, StoryViewer } from "@/lib/stories/types";
import { cn } from "@/lib/utils";

type Tab = "aktiv" | "abgelaufen" | "highlights";
const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.emoji])) as Record<string, string>;

/** Eigene Stories: aktiv / abgelaufen / Highlights, Kennzahlen, Viewer-Liste, Highlight setzen, löschen. */
export function StoryManageList({ stories }: { stories: ManagedStory[] }) {
  const [tab, setTab] = useState<Tab>("aktiv");
  const [viewersOf, setViewersOf] = useState<string | null>(null);
  const [hlOf, setHlOf] = useState<ManagedStory | null>(null);
  const counts = { aktiv: stories.filter((s) => s.active).length, abgelaufen: stories.filter((s) => !s.active).length, highlights: stories.filter((s) => s.highlight).length };
  const shown = stories.filter((s) => (tab === "aktiv" ? s.active : tab === "abgelaufen" ? !s.active : s.highlight));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b" role="tablist">
        {(["aktiv", "abgelaufen", "highlights"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-3 pb-2.5 text-sm font-semibold text-muted-foreground capitalize hover:text-foreground",
              tab === t && "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary",
            )}
          >
            {t === "aktiv" ? "Aktiv" : t === "abgelaufen" ? "Abgelaufen" : "Highlights"} <span className="text-xs text-muted-foreground">{counts[t]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {tab === "aktiv" ? "Keine aktiven Stories. Erstelle oben deine erste Story!" : tab === "highlights" ? "Noch keine Highlights." : "Keine abgelaufenen Stories."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((s) => (
            <li key={s.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
              <Link href={`/stories/${s.id}`} className="relative aspect-[9/16] bg-neutral-900">
                {s.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumbUrl} alt="" className={cn("size-full object-cover", !s.active && "opacity-60")} loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center text-white/60">
                    <Play className="size-8" />
                  </span>
                )}
                {s.highlight && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-black">
                    <Star className="size-3" /> {s.highlightTitle || "Highlight"}
                  </span>
                )}
                {s.overlayText && <span className="absolute inset-x-2 bottom-2 truncate rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{s.overlayText}</span>}
              </Link>
              <div className="flex flex-col gap-2 p-2.5">
                <div className="flex items-center gap-3 text-xs">
                  <button type="button" onClick={() => setViewersOf(s.id)} className="inline-flex items-center gap-1 font-semibold hover:text-primary" aria-label="Viewer-Liste">
                    <Eye className="size-3.5" /> {s.views}
                  </button>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Heart className="size-3.5" /> {s.likes}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MessageCircle className="size-3.5" /> {s.comments}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {s.active ? (
                    <>
                      Läuft ab <RelativeTime iso={s.expiresAt} />
                    </>
                  ) : (
                    <>
                      Erstellt <RelativeTime iso={s.createdAt} />
                    </>
                  )}
                </p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 flex-1 px-2 text-[11px]" onClick={() => setHlOf(s)}>
                    <Star /> {s.highlight ? "Bearbeiten" : "Highlight"}
                  </Button>
                  <DeleteButton id={s.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {viewersOf && <ViewersDialog storyId={viewersOf} onClose={() => setViewersOf(null)} />}
      {hlOf && <HighlightDialog story={hlOf} onClose={() => setHlOf(null)} />}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="size-7 text-muted-foreground hover:text-destructive"
      aria-label="Story löschen"
      disabled={pending}
      onClick={() => {
        if (!confirm("Story endgültig löschen?")) return;
        start(async () => {
          const res = await deleteStory(id);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}

function HighlightDialog({ story, onClose }: { story: ManagedStory; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(story.highlightTitle ?? "");
  const [pending, start] = useTransition();
  const save = (t: string | null) =>
    start(async () => {
      const res = await setStoryHighlight({ id: story.id, title: t });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t === null ? "Highlight entfernt" : "Als Highlight gespeichert");
      onClose();
      router.refresh();
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Story-Highlight</DialogTitle>
          <DialogDescription>Highlights bleiben nach Ablauf der 24 Stunden in deinem Profil sichtbar. Stories mit gleichem Titel werden gruppiert.</DialogDescription>
        </DialogHeader>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Titel, z. B. Reisen" aria-label="Titel" autoFocus />
        <DialogFooter>
          {story.highlight && (
            <Button variant="outline" onClick={() => save(null)} disabled={pending}>
              Entfernen
            </Button>
          )}
          <Button onClick={() => save(title.trim() || "Highlights")} disabled={pending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewersDialog({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const [list, setList] = useState<StoryViewer[] | null>(null);
  useEffect(() => {
    let alive = true;
    storyViewers(storyId).then((r) => {
      if (!alive) return;
      if (r.ok) setList(r.data);
      else {
        toast.error(r.error);
        setList([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [storyId]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Wer hat deine Story gesehen</DialogTitle>
          <DialogDescription>Inkognito-Besucher erscheinen mit Milchglas-Avatar, ohne Namen und Link.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
          {list === null && <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />}
          {list?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Aufrufe.</p>}
          {list?.map((v) => (
            <div key={v.key} className="flex items-center gap-3 rounded-md px-1 py-1.5">
              <UserAvatar user={v.user} link size="sm" />
              {"anonymous" in v.user ? (
                <span className="flex-1 text-sm text-muted-foreground italic">{v.user.name}</span>
              ) : (
                <Link href={v.user.href} className="flex-1 truncate text-sm font-medium hover:underline">
                  {v.user.name}
                </Link>
              )}
              {v.reaction && <span className="text-base">{EMOJI[v.reaction]}</span>}
              <RelativeTime iso={v.viewedAt} className="text-xs text-muted-foreground" />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
