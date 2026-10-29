"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { StoryAuthorEntry } from "@/lib/stories/types";
import { cn } from "@/lib/utils";
import { StoryViewer } from "./story-viewer";

/** Story-Leiste (Feed-Kopf und /stories): eigene, gefolgte und Favoriten zuerst. */
export function StoriesBar({
  entries,
  viewerId,
  canCreate,
  layout = "row",
}: {
  entries: StoryAuthorEntry[];
  viewerId: string | null;
  canCreate?: boolean;
  layout?: "row" | "grid";
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const hasOwn = entries.some((e) => e.own);

  if (!entries.length && !canCreate) return null;
  const openAt = (i: number) => {
    if (!viewerId) return router.push(`/anmelden?next=${encodeURIComponent(window.location.pathname)}`);
    setOpen(i);
  };

  return (
    <>
      <div
        className={cn(
          layout === "row" ? "flex gap-3 overflow-x-auto px-1 pt-1.5 pb-1 [scrollbar-width:none]" : "grid grid-cols-3 gap-4 sm:grid-cols-5 md:grid-cols-6",
        )}
        role="list"
        aria-label="Stories"
      >
        {canCreate && !hasOwn && (
          <Link href="/dashboard/stories" role="listitem" className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary">
              <Plus className="size-6" />
            </span>
            <span className="w-full truncate text-[11px] text-muted-foreground">Deine Story</span>
          </Link>
        )}
        {entries.map((e, i) => {
          const isSeen = e.seen || seen.has(e.author.id);
          return (
            <button
              key={e.author.id}
              type="button"
              role="listitem"
              onClick={() => openAt(i)}
              className={cn("flex shrink-0 flex-col items-center gap-1.5 text-center", layout === "row" ? "w-[72px]" : "w-full")}
              aria-label={`Story von ${e.author.name} ansehen`}
            >
              <UserAvatar user={e.author} size="md" ring={isSeen ? "seen" : "story"} className={layout === "grid" ? "scale-110" : undefined} />
              <span className={cn("w-full truncate text-[11px]", isSeen ? "text-muted-foreground" : "font-medium")}>{e.own ? "Deine Story" : e.author.name}</span>
            </button>
          );
        })}
      </div>
      {open !== null && viewerId && (
        <StoryViewer
          queue={entries.map((e) => ({ author: e.author }))}
          start={open}
          viewerId={viewerId}
          onClose={() => setOpen(null)}
          onSeen={(id) => setSeen((s) => new Set(s).add(id))}
        />
      )}
    </>
  );
}
