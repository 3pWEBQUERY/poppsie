"use client";

import { useState } from "react";
import { FileClock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deleteDraft, listDrafts } from "@/lib/content/actions";
import type { DraftView } from "@/lib/content/types";
import { RelativeTime } from "./relative-time";

/** Gespeicherte Entwürfe des aktuellen Kontexts anzeigen, laden und löschen. */
export function DraftMenu({
  context,
  groupId,
  threadId,
  onLoad,
  refreshKey,
}: {
  context: "feed" | "group" | "forum";
  groupId?: string | null;
  threadId?: string | null;
  onLoad: (d: DraftView) => void;
  refreshKey: number;
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftView[] | null>(null);
  const [loadedKey, setLoadedKey] = useState(-1);

  const load = async () => {
    const res = await listDrafts({ context, groupId, threadId });
    if (res.ok) setDrafts(res.data);
    setLoadedKey(refreshKey);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && loadedKey !== refreshKey) {
          setDrafts(null);
          void load();
        }
      }}
    >
      <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
        <FileClock className="size-4" /> Entwürfe
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-1">
        {!drafts && <Loader2 className="mx-auto my-4 size-4 animate-spin text-muted-foreground" />}
        {drafts?.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Keine Entwürfe gespeichert</p>}
        {drafts?.map((d) => (
          <div key={d.id} className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                onLoad(d);
                setOpen(false);
              }}
            >
              <span className="line-clamp-2 text-sm">{d.body || <em className="text-muted-foreground">Ohne Text</em>}</span>
              <span className="text-[11px] text-muted-foreground">
                <RelativeTime iso={d.updatedAt} />
                {d.media.length ? ` · ${d.media.length} Medien` : ""}
              </span>
            </button>
            <button
              type="button"
              aria-label="Entwurf löschen"
              className="rounded p-1 text-muted-foreground hover:text-destructive"
              onClick={async () => {
                const res = await deleteDraft(d.id);
                if (!res.ok) return toast.error(res.error);
                setDrafts((x) => x?.filter((y) => y.id !== d.id) ?? null);
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
