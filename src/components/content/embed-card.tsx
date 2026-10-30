import Link from "next/link";
import { CircleOff, FileText, MessagesSquare, PlayCircle, User, Users, X } from "lucide-react";
import type { EmbedPreview } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const ICONS = { profile: User, thread: MessagesSquare, post: FileText, group: Users, highlight: PlayCircle } as const;

/** Vorschaukarte für eingebettete Inhalte; das Original bleibt verlinkt. */
export function EmbedCard({ e, onRemove, className }: { e: EmbedPreview; onRemove?: () => void; className?: string }) {
  const Icon = ICONS[e.type];
  if (!e.available) {
    return (
      <div className={cn("flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground", className)}>
        <CircleOff className="size-4" /> {e.label}: Inhalt nicht verfügbar
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    );
  }
  const round = e.type === "profile" || e.type === "highlight";
  const body = (
    <>
      {e.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.imageUrl} alt="" loading="lazy" className={cn("size-16 shrink-0 object-cover", round ? "rounded-full" : "rounded-md")} />
      ) : (
        <span className={cn("flex size-16 shrink-0 items-center justify-center bg-secondary text-muted-foreground", round ? "rounded-full" : "rounded-md")}>
          <Icon className="size-6" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-primary uppercase">
          <Icon className="size-3" /> {e.label}
        </span>
        <span className="truncate text-sm font-semibold">{e.title}</span>
        {e.subtitle && <span className="truncate text-xs text-muted-foreground">{e.subtitle}</span>}
        {e.excerpt && <span className="line-clamp-2 text-xs text-muted-foreground">{e.excerpt}</span>}
      </span>
    </>
  );
  return (
    <div className={cn("relative", className)}>
      <Link href={e.href} className="flex items-center gap-3 rounded-md border border-l-2 border-l-primary bg-background/40 p-2.5 pr-8 transition-colors hover:bg-accent">
        {body}
      </Link>
      {onRemove && <RemoveButton onRemove={onRemove} />}
    </div>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} aria-label="Einbettung entfernen" className="absolute top-1.5 right-1.5 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
      <X className="size-3.5" />
    </button>
  );
}
