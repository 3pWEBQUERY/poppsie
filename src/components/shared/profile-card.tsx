import Link from "next/link";
import { BadgeCheck, MapPin, Sparkles } from "lucide-react";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { StarRating } from "@/components/shared/star-rating";
import { cn } from "@/lib/utils";

export type ProfileCardData = {
  id: string;
  href: string;
  name: string;
  accountType: "member" | "escort" | "club";
  imageUrl: string | null;
  subtitle?: string | null;
  age?: number | null;
  city?: string | null;
  distanceKm?: number | null;
  ratingAvg?: number;
  ratingCount?: number;
  verified?: boolean;
  hasStory?: boolean;
  availableToday?: boolean;
  isNew?: boolean;
  matchScore?: number | null;
  isFavorite?: boolean;
};

/** Profilkarte für Suche, Matches und Favoriten. */
export function ProfileCard({ p, showFavorite = true, className }: { p: ProfileCardData; showFavorite?: boolean; className?: string }) {
  return (
    <Link href={p.href} className={cn("group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/40", className)}>
      <div className={cn("relative aspect-[3/4] bg-muted", p.hasStory && "outline-2 -outline-offset-2 outline-primary")}>
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-4xl font-bold text-muted-foreground">{p.name.slice(0, 1)}</div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
          <div className="flex flex-wrap gap-1">
            {p.matchScore != null && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{p.matchScore}% Match</span>}
            {p.availableToday && <span className="rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-white">Heute verfügbar</span>}
            {p.isNew && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                <Sparkles className="size-3" /> Neu
              </span>
            )}
          </div>
          {showFavorite && (
            <span className="rounded-full bg-background/80 p-1.5">
              <FavoriteButton targetId={p.id} initial={Boolean(p.isFavorite)} />
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display font-semibold">{p.name}</span>
          {p.age ? <span className="text-sm text-muted-foreground">{p.age}</span> : null}
          {p.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verifiziert" />}
        </div>
        {p.subtitle && <span className="truncate text-xs text-muted-foreground">{p.subtitle}</span>}
        {(p.city || p.distanceKm != null) && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {p.city}
            {p.distanceKm != null && ` · ${p.distanceKm < 1 ? "< 1" : Math.round(p.distanceKm)} km`}
          </span>
        )}
        {p.ratingCount ? (
          <span className="flex items-center gap-1.5 text-xs">
            <StarRating value={p.ratingAvg ?? 0} size="xs" />
            <span className="text-muted-foreground">
              {(p.ratingAvg ?? 0).toFixed(1)} · {p.ratingCount} {p.ratingCount === 1 ? "Bericht" : "Berichte"}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Noch keine Berichte</span>
        )}
      </div>
    </Link>
  );
}
