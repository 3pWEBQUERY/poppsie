"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleFavorite } from "@/app/actions/favorites";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { cn } from "@/lib/utils";

export function FavoriteButton({ targetId, initial, className, withLabel }: { targetId: string; initial: boolean; className?: string; withLabel?: boolean }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          const res = await toggleFavorite(targetId);
          if (res.ok) setFav(res.data.favorite);
          else if (!handleLocked(res)) toast.error(res.error);
        });
      }}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <Heart className={cn("size-5 transition-colors", fav ? "fill-primary text-primary" : "")} />
      {withLabel && <span className="text-xs">{fav ? "Gemerkt" : "Merken"}</span>}
    </button>
  );
}
