import Link from "next/link";
import { EyeOff, Globe, Lock, MapPin, Users } from "lucide-react";
import { CANTON_NAMES } from "@/lib/geo/countries";
import { PRIVACY_LABELS, type GroupCardView } from "@/lib/groups/types";
import { cn } from "@/lib/utils";

export const PRIVACY_ICON = { public: Globe, private: Lock, secret: EyeOff } as const;

const STATUS_LABEL = { active: "Mitglied", pending: "Angefragt", invited: "Eingeladen", banned: "" } as const;

/** Gruppenkarte für Suche, Vorschläge und "Meine Gruppen". */
export function GroupCard({ g, className }: { g: GroupCardView; className?: string }) {
  const Icon = PRIVACY_ICON[g.privacy];
  return (
    <Link href={`/gruppen/${g.slug}`} className={cn("group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/30", className)}>
      <div className="relative aspect-[3/1] bg-secondary">
        {g.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Users className="size-8" />
          </span>
        )}
        {g.myStatus && g.myStatus !== "banned" && (
          <span className={cn("absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold", g.myStatus === "active" ? "bg-primary text-primary-foreground" : "bg-background/90")}>
            {STATUS_LABEL[g.myStatus]}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-bold group-hover:text-primary">{g.name}</h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Icon className="size-3" /> {PRIVACY_LABELS[g.privacy]}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {g.memberCount} Mitglieder
          </span>
          {g.region && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {CANTON_NAMES[g.region as keyof typeof CANTON_NAMES] ?? g.region}
            </span>
          )}
        </div>
        {g.description && <p className="line-clamp-2 text-xs text-muted-foreground">{g.description}</p>}
      </div>
    </Link>
  );
}
