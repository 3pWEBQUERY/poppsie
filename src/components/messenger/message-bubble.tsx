"use client";

import { useRef, useState } from "react";
import { Ban, CalendarDays, Check, CheckCheck, Copy, Flag, MoreHorizontal, Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BookingCard } from "@/components/bookings/booking-card";
import { EmojiPanel } from "@/components/shared/emoji-picker";
import { ReportDialog } from "@/components/shared/report-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EDIT_WINDOW_MS, type MessageView } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { Attachments } from "./attachments";
import { timeOf } from "./format";

const QUICK = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

export type TickState = "sent" | "delivered" | "read";

type Props = {
  m: MessageView;
  mine: boolean;
  viewerId: string;
  tick: TickState | null;
  now: number;
  nameOf: (userId: string) => string;
  highlighted?: boolean;
  onReply: (m: MessageView) => void;
  onEdit: (m: MessageView) => void;
  onDelete: (m: MessageView) => void;
  onReact: (m: MessageView, emoji: string) => void;
  onJump: (messageId: string) => void;
  onRefresh: (m: MessageView) => void;
};

export function MessageBubble({ m, mine, viewerId, tick, now, nameOf, highlighted, onReply, onEdit, onDelete, onReact, onJump, onRefresh }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tapped, setTapped] = useState(false);
  const reportRef = useRef<HTMLButtonElement>(null);
  const deleted = Boolean(m.deletedAt);

  if (m.type === "system") {
    return <div className="my-1 self-center rounded-full bg-secondary px-3 py-1 text-center text-xs text-muted-foreground">{m.body}</div>;
  }

  if (m.type === "booking_card") {
    return (
      <div id={`m-${m.id}`} className={cn("flex w-full max-w-sm flex-col gap-1", mine ? "self-end" : "self-start")}>
        {m.booking ? (
          <BookingCard booking={m.booking} viewerId={viewerId} />
        ) : (
          <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
            <CalendarDays className="size-4" /> Buchung
          </div>
        )}
        <span className={cn("px-1 text-[10px] text-muted-foreground", mine && "text-right")}>{timeOf(m.createdAt)}</span>
      </div>
    );
  }

  const canEdit = mine && !deleted && now - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS && Boolean(m.body || m.type === "text");
  const actionsVisible = pickerOpen || menuOpen;

  return (
    <div id={`m-${m.id}`} className={cn("group flex w-full items-end gap-1", mine ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("flex max-w-[85%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        <div
          onClick={(e) => {
            // Touch: Antippen zeigt die Aktionen (Desktop: Hover)
            if (!(e.target as HTMLElement).closest("button, a, input, audio, video")) setTapped((t) => !t);
          }}
          className={cn(
            "relative rounded-2xl px-3 py-2 text-sm break-words transition-colors",
            mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-secondary text-foreground",
            deleted && "border border-dashed border-border bg-transparent text-muted-foreground italic",
            highlighted && "ring-2 ring-warning",
          )}
        >
          {m.replyTo && !deleted && (
            <button
              type="button"
              onClick={() => onJump(m.replyTo!.id)}
              className={cn("mb-1.5 block w-full rounded-md border-l-2 px-2 py-1 text-left text-xs", mine ? "border-white/70 bg-black/15" : "border-primary bg-background/50")}
            >
              <span className="block font-semibold">{nameOf(m.replyTo.senderId)}</span>
              <span className="line-clamp-2 opacity-80">{m.replyTo.deleted ? "Nachricht gelöscht" : m.replyTo.preview}</span>
            </button>
          )}
          {deleted ? (
            <span className="flex items-center gap-1.5">
              <Ban className="size-3.5" /> Nachricht gelöscht
            </span>
          ) : (
            <>
              {m.attachments.length > 0 && (
                <div className={cn(m.body && "mb-1.5")}>
                  <Attachments messageId={m.id} items={m.attachments} mine={mine} onViewed={() => onRefresh(m)} />
                </div>
              )}
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            </>
          )}
          <span className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine && !deleted ? "text-white/75" : "text-muted-foreground")}>
            {m.editedAt && !deleted && <span>bearbeitet</span>}
            <span>{timeOf(m.createdAt)}</span>
            {mine && !deleted && tick && <Tick state={tick} />}
          </span>
        </div>
        {m.reactions.length > 0 && (
          <div className={cn("-mt-1.5 flex flex-wrap gap-1 px-2", mine ? "justify-end" : "justify-start")}>
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(m, r.emoji)}
                title={r.userIds.map(nameOf).join(", ")}
                aria-label={`${r.emoji} ${r.count}${r.mine ? ", deine Reaktion" : ""}`}
                className={cn("flex h-6 items-center gap-1 rounded-full border bg-card px-1.5 text-xs", r.mine && "border-primary")}
              >
                <span className="text-sm leading-none">{r.emoji}</span>
                {r.count > 1 && <span className="tabular-nums">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!deleted && (
        <div
          className={cn(
            "mb-1 shrink-0 items-center gap-0.5",
            actionsVisible || tapped ? "flex" : "hidden md:flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100",
          )}
        >
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger aria-label="Reagieren" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <SmilePlus className="size-4" />
            </PopoverTrigger>
            <PopoverContent align={mine ? "end" : "start"} className="w-[330px] p-0">
              <div className="flex justify-between border-b p-2">
                {QUICK.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onReact(m, e);
                      setPickerOpen(false);
                    }}
                    className="rounded-md p-1 text-2xl leading-none hover:bg-accent"
                    aria-label={`Mit ${e} reagieren`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              {pickerOpen && (
                <EmojiPanel
                  onSelect={(e) => {
                    onReact(m, e);
                    setPickerOpen(false);
                  }}
                />
              )}
            </PopoverContent>
          </Popover>
          <button type="button" aria-label="Antworten" onClick={() => onReply(m)} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Reply className="size-4" />
          </button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger aria-label="Weitere Aktionen" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
              <DropdownMenuItem onSelect={() => onReply(m)}>
                <Reply /> Antworten
              </DropdownMenuItem>
              {m.body && (
                <DropdownMenuItem
                  onSelect={() => {
                    navigator.clipboard?.writeText(m.body ?? "").then(
                      () => toast.success("Kopiert"),
                      () => toast.error("Kopieren nicht möglich"),
                    );
                  }}
                >
                  <Copy /> Text kopieren
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onSelect={() => onEdit(m)}>
                  <Pencil /> Bearbeiten
                </DropdownMenuItem>
              )}
              {mine && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(m)}>
                    <Trash2 /> Für beide löschen
                  </DropdownMenuItem>
                </>
              )}
              {!mine && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => reportRef.current?.click(), 0)}>
                    <Flag /> Nachricht melden
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {!mine && <ReportDialog targetType="message" targetId={m.id} targetUserId={m.senderId} trigger={<button ref={reportRef} type="button" className="hidden" tabIndex={-1} aria-hidden />} />}
        </div>
      )}
    </div>
  );
}

function Tick({ state }: { state: TickState }) {
  if (state === "read") return <CheckCheck className="size-3.5 text-sky-300" aria-label="Gelesen" />;
  if (state === "delivered") return <CheckCheck className="size-3.5" aria-label="Zugestellt" />;
  return <Check className="size-3.5" aria-label="Gesendet" />;
}
