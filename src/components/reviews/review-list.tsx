"use client";

import { useMemo, useState } from "react";
import { REVIEW_SORTS, type Criterion, type ReviewSort } from "@/lib/reviews/criteria";
import type { ReviewItem } from "@/lib/reviews/queries";
import { cn } from "@/lib/utils";
import { ReviewCard, type ReviewViewer } from "./review-card";

const PAGE = 10;

/** Sortierbare Berichtsliste (neueste, beste, schlechteste) mit „Mehr anzeigen“. */
export function ReviewList({ items, viewer, criteria, initialSort = "neueste", showTarget }: { items: ReviewItem[]; viewer: ReviewViewer; criteria: Criterion[]; initialSort?: ReviewSort; showTarget?: boolean }) {
  const [sort, setSort] = useState<ReviewSort>(initialSort);
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === "beste") list.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
    else if (sort === "schlechteste") list.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [items, sort]);

  return (
    <div className="flex flex-col gap-3">
      {items.length > 1 && (
        <div className="flex items-center gap-1" role="group" aria-label="Sortierung">
          <span className="mr-1 text-xs text-muted-foreground">Sortieren:</span>
          {REVIEW_SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={sort === s.value}
              onClick={() => setSort(s.value)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", sort === s.value ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40")}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {sorted.slice(0, shown).map((r) => (
        <ReviewCard key={r.id} item={r} viewer={viewer} criteria={criteria} showTarget={showTarget} />
      ))}
      {sorted.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-md border py-2 text-sm font-medium hover:bg-accent">
          Weitere Berichte anzeigen ({sorted.length - shown})
        </button>
      )}
    </div>
  );
}
