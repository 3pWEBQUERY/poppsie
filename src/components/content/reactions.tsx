"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { listReactors, toggleReaction } from "@/lib/content/actions";
import { REACTIONS, type ReactionKind, type ReactionSummary, type ReactionTarget, type Reactor } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.emoji])) as Record<ReactionKind, string>;
const LABEL = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.label])) as Record<ReactionKind, string>;

/**
 * Like-Button plus 5 Reaktionen (Hover oder langes Drücken öffnet die Auswahl).
 * variant="danke" zeigt im Forum "Danke" statt "Gefällt mir".
 */
export function ReactionButton({
  targetType,
  targetId,
  value,
  onChange,
  disabled,
  variant = "default",
  className,
}: {
  targetType: ReactionTarget;
  targetId: string;
  value: ReactionSummary;
  onChange: (v: ReactionSummary) => void;
  disabled?: boolean;
  variant?: "default" | "danke" | "compact";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const locked = useLockedHandler();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const react = (kind: ReactionKind) => {
    setOpen(false);
    // Optimistisch aktualisieren.
    const prev = value;
    const counts = { ...prev.counts };
    let total = prev.total;
    if (prev.mine) {
      counts[prev.mine] = Math.max(0, (counts[prev.mine] ?? 1) - 1);
      total -= 1;
    }
    const removing = prev.mine === kind;
    if (!removing) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      total += 1;
    }
    onChange({ counts, total, mine: removing ? null : kind });
    start(async () => {
      const res = await toggleReaction({ targetType, targetId, kind });
      if (!res.ok) {
        onChange(prev);
        if (!locked(res)) toast.error(res.error);
        return;
      }
      onChange(res.data);
    });
  };

  const mine = value.mine;
  const label = mine ? LABEL[mine] : variant === "danke" ? "Danke" : "Gefällt mir";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          disabled={disabled || pending}
          aria-label={mine ? `Reaktion: ${LABEL[mine]} (entfernen)` : label}
          aria-pressed={Boolean(mine)}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            react(mine ?? "like");
          }}
          onMouseEnter={() => {
            if (disabled) return;
            hoverTimer.current = setTimeout(() => setOpen(true), 450);
          }}
          onMouseLeave={() => hoverTimer.current && clearTimeout(hoverTimer.current)}
          onTouchStart={() => {
            if (disabled) return;
            pressTimer.current = setTimeout(() => {
              longPressed.current = true;
              setOpen(true);
            }, 450);
          }}
          onTouchEnd={() => pressTimer.current && clearTimeout(pressTimer.current)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!disabled) setOpen(true);
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
            mine ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            variant === "danke" && !mine && "border border-border",
            className,
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : mine ? <span className="text-base leading-none">{EMOJI[mine]}</span> : <ThumbsUp className="size-4" />}
          {variant !== "compact" && <span>{label}</span>}
        </button>
      </PopoverAnchor>
      <PopoverContent side="top" align="start" className="w-auto p-1" onMouseLeave={() => setOpen(false)}>
        <div className="flex gap-0.5" role="group" aria-label="Reaktion wählen">
          {REACTIONS.map((r) => (
            <button
              key={r.kind}
              type="button"
              title={r.label}
              aria-label={r.label}
              onClick={() => react(r.kind)}
              className={cn("flex size-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-125 hover:bg-accent", value.mine === r.kind && "bg-accent")}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Zusammenfassung (Top-Emojis + Anzahl); öffnet "Wer hat reagiert". */
export function ReactionSummaryButton({ targetType, targetId, value, className }: { targetType: ReactionTarget; targetId: string; value: ReactionSummary; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!value.total) return null;
  const top = (Object.entries(value.counts) as [ReactionKind, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline", className)}>
        <span className="flex -space-x-0.5">
          {top.map(([k]) => (
            <span key={k} className="text-sm leading-none">
              {EMOJI[k]}
            </span>
          ))}
        </span>
        {value.total}
      </button>
      {open && <ReactorsDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} counts={value.counts} />}
    </>
  );
}

function ReactorsDialog({ targetType, targetId, onClose, counts }: { targetType: ReactionTarget; targetId: string; onClose: () => void; counts: ReactionSummary["counts"] }) {
  const [list, setList] = useState<Reactor[] | null>(null);
  const [filter, setFilter] = useState<ReactionKind | "all">("all");
  useEffect(() => {
    let alive = true;
    listReactors({ targetType, targetId }).then((res) => {
      if (!alive) return;
      if (res.ok) setList(res.data);
      else toast.error(res.error);
    });
    return () => {
      alive = false;
    };
  }, [targetType, targetId]);
  const shown = (list ?? []).filter((r) => filter === "all" || r.kind === filter);
  const kinds = (Object.entries(counts) as [ReactionKind, number][]).filter(([, n]) => n > 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Wer hat reagiert</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1 border-b pb-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            Alle
          </FilterChip>
          {kinds.map(([k, n]) => (
            <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>
              {EMOJI[k]} {n}
            </FilterChip>
          ))}
        </div>
        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {!list && <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />}
          {list && shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Keine sichtbaren Reaktionen</p>}
          {shown.map((r) => (
            <div key={r.user.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
              <span className="relative">
                <UserAvatar user={r.user} link size="sm" />
                <span className="absolute -right-1 -bottom-1 text-sm">{EMOJI[r.kind]}</span>
              </span>
              <Link href={r.user.href} className="truncate text-sm font-medium hover:underline">
                {r.user.name}
              </Link>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent")}>
      {children}
    </button>
  );
}
