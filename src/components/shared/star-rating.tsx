"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Anzeige (value) oder Eingabe (onChange) von 1–5 Sternen, per Tastatur bedienbar. */
export function StarRating({
  value,
  onChange,
  size = "sm",
  className,
  label = "Bewertung",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const cls = size === "xs" ? "size-3" : size === "md" ? "size-6" : "size-4";
  if (!onChange) {
    return (
      <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${label}: ${value.toFixed(1)} von 5`} role="img">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(cls, i <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40")} />
        ))}
      </span>
    );
  }
  return (
    <span role="radiogroup" aria-label={label} className={cn("inline-flex items-center gap-1", className)} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} Sterne`}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => setHover(i)}
          onClick={() => onChange(i)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(5, value + 1));
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, value - 1));
          }}
        >
          <Star className={cn(cls, i <= shown ? "fill-primary text-primary" : "text-muted-foreground/50")} />
        </button>
      ))}
    </span>
  );
}
