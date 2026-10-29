"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CirclePlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Author } from "@/lib/content/types";
import type { HighlightGroup } from "@/lib/stories/types";
import { StoryViewer, type StorySource } from "./story-viewer";

/** Button "Story ansehen" (Story-Ring) und Highlight-Reihe auf Profilseiten. */
export function ProfileStoriesClient({ author, hasActive, highlights, viewerId }: { author: Author; hasActive: boolean; highlights: HighlightGroup[]; viewerId: string | null }) {
  const router = useRouter();
  const [source, setSource] = useState<StorySource | null>(null);
  const open = (s: StorySource) => {
    if (!viewerId) return router.push(`/anmelden?next=${encodeURIComponent(window.location.pathname)}`);
    setSource(s);
  };
  return (
    <div className="flex flex-col gap-3">
      {hasActive && (
        <Button type="button" variant="outline" size="sm" onClick={() => open({ author })} className="w-fit border-primary text-primary hover:bg-primary hover:text-primary-foreground">
          <CirclePlay /> Story ansehen
        </Button>
      )}
      {highlights.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-1 pt-1 pb-1 [scrollbar-width:none]" role="list" aria-label="Story-Highlights">
          {highlights.map((h) => (
            <button
              key={h.key}
              type="button"
              role="listitem"
              onClick={() => open({ author, highlights: { ids: h.storyIds } })}
              className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
              aria-label={`Highlight ${h.title} ansehen`}
            >
              <span className="size-16 overflow-hidden rounded-full border-2 border-border p-0.5">
                {h.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.coverUrl} alt="" className="size-full rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center rounded-full bg-secondary">
                    <CirclePlay className="size-5 text-muted-foreground" />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[11px]">{h.title}</span>
            </button>
          ))}
        </div>
      )}
      {source && viewerId && <StoryViewer queue={[source]} viewerId={viewerId} onClose={() => setSource(null)} />}
    </div>
  );
}
