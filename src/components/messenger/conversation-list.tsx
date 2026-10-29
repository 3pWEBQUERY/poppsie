"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, BellOff, Bell, Loader2, MessageCircle, MoreHorizontal, Pin, PinOff, Search, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { ConversationItem } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { loadConversations } from "@/app/(site)/dashboard/nachrichten/actions";
import { listTime } from "./format";

export type ListTab = "all" | "requests" | "archive";
type Flag = "pinned" | "archived" | "muted";

export function ConversationList({
  items,
  activeId,
  typing,
  tab,
  onTab,
  onSelect,
  onFlag,
}: {
  items: ConversationItem[];
  activeId: string | null;
  typing: Record<string, boolean>;
  tab: ListTab;
  onTab: (t: ListTab) => void;
  onSelect: (id: string) => void;
  onFlag: (id: string, flag: Flag, value: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<{ q: string; ids: Set<string> } | null>(null);
  const [searching, setSearching] = useState(false);
  const q = query.trim().toLowerCase();

  // Serverseitige Suche (auch im Nachrichtentext), lokal sofort nach Name/Vorschau.
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await loadConversations(q);
      if (cancelled) return;
      setSearching(false);
      if (res.ok) setRemote({ q, ids: new Set(res.data.map((c) => c.id)) });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const requests = items.filter((c) => c.incomingRequest && !c.archived);
  const requestUnread = requests.filter((c) => c.unread > 0).length;

  const visible = useMemo(() => {
    if (q) {
      return items.filter(
        (c) =>
          c.partner.name.toLowerCase().includes(q) ||
          c.partner.username.toLowerCase().includes(q) ||
          c.preview.toLowerCase().includes(q) ||
          (remote?.q === q && remote.ids.has(c.id)),
      );
    }
    if (tab === "requests") return items.filter((c) => c.incomingRequest && !c.archived);
    if (tab === "archive") return items.filter((c) => c.archived);
    return items.filter((c) => !c.archived && !c.incomingRequest);
  }, [items, q, remote, tab]);

  const TABS: { id: ListTab; label: string; count?: number }[] = [
    { id: "all", label: "Chats" },
    { id: "requests", label: "Anfragen", count: requests.length },
    { id: "archive", label: "Archiv" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chats durchsuchen"
            aria-label="Chats durchsuchen"
            className="h-9 w-full rounded-md border border-input bg-background pr-8 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          {query && (
            <button type="button" aria-label="Suche löschen" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {searching ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            </button>
          )}
        </div>
        {!q && (
          <div role="tablist" aria-label="Filter" className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => onTab(t.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  tab === t.id && "border-foreground bg-foreground text-background hover:text-background",
                )}
              >
                {t.label}
                {t.count ? (
                  <span className={cn("rounded-full px-1.5 text-[10px] font-bold", requestUnread ? "bg-primary text-white" : "bg-secondary text-foreground")}>{t.count}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Chats">
        {visible.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
            <MessageCircle className="size-8" />
            {q ? "Keine Treffer" : tab === "requests" ? "Keine offenen Anfragen" : tab === "archive" ? "Keine archivierten Chats" : "Noch keine Chats. Schreib jemandem über sein Profil."}
          </li>
        )}
        {visible.map((c) => (
          <Row key={c.id} c={c} active={c.id === activeId} typing={Boolean(typing[c.id])} onSelect={onSelect} onFlag={onFlag} />
        ))}
      </ul>
    </div>
  );
}

function Row({
  c,
  active,
  typing,
  onSelect,
  onFlag,
}: {
  c: ConversationItem;
  active: boolean;
  typing: boolean;
  onSelect: (id: string) => void;
  onFlag: (id: string, flag: Flag, value: boolean) => void;
}) {
  const unread = active ? 0 : c.unread;
  return (
    <li className={cn("group relative border-b border-border/60", active && "bg-accent")}>
      <button
        type="button"
        onClick={() => onSelect(c.id)}
        aria-current={active ? "true" : undefined}
        className="flex w-full items-center gap-3 px-3 py-2.5 pr-9 text-left transition-colors hover:bg-accent/60"
      >
        <UserAvatar user={c.partner} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-sm", unread ? "font-bold" : "font-semibold")}>{c.partner.name}</span>
            {c.pinned && <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="Angepinnt" />}
            {c.muted && <BellOff className="size-3 shrink-0 text-muted-foreground" aria-label="Stumm" />}
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{listTime(c.lastMessageAt)}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-xs", typing ? "text-success" : unread ? "text-foreground" : "text-muted-foreground")}>
              {typing ? "schreibt …" : c.blocked ? "Blockiert" : c.preview}
            </span>
            {c.incomingRequest && <span className="shrink-0 rounded-sm border border-primary px-1 text-[10px] font-semibold text-primary">Anfrage</span>}
            {unread > 0 && (
              <span className={cn("ml-auto flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white", c.muted ? "bg-muted-foreground" : "bg-primary")}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Optionen für ${c.partner.name}`}
          className="absolute top-2 right-1.5 rounded-md p-1 text-muted-foreground opacity-100 hover:bg-secondary hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onFlag(c.id, "pinned", !c.pinned)}>
            {c.pinned ? <PinOff /> : <Pin />} {c.pinned ? "Lösen" : "Anpinnen"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onFlag(c.id, "muted", !c.muted)}>
            {c.muted ? <Bell /> : <BellOff />} {c.muted ? "Stummschaltung aufheben" : "Stummschalten"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onFlag(c.id, "archived", !c.archived)}>
            {c.archived ? <ArchiveRestore /> : <Archive />} {c.archived ? "Aus dem Archiv holen" : "Archivieren"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
