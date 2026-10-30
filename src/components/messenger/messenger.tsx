"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useLockedHandler } from "@/components/shared/profile-lock";
import type { ConversationItem, ThreadData, ThreadMeta } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { loadConversationItem } from "@/app/(site)/dashboard/nachrichten/actions";
import { setConversationFlag } from "@/app/(site)/dashboard/nachrichten/conversation-actions";
import { ConversationList, type ListTab } from "./conversation-list";
import { Thread } from "./thread";
import { useRealtime } from "./use-realtime";

type Flag = "pinned" | "archived" | "muted";

type Props = {
  me: { id: string; name: string };
  initialList: ConversationItem[];
  initialThread: ThreadData | null;
  draft: ThreadMeta | null;
  notice?: string | null;
};

function sortList(list: ConversationItem[]) {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastMessageAt.localeCompare(a.lastMessageAt));
}

/**
 * Messenger: Liste links, Verlauf rechts (mobil eine Spalte mit Zurück).
 * Auswahl wird in der URL gehalten (?c=<id>), ohne die Seite neu zu laden.
 */
export function Messenger({ me, initialList, initialThread, draft: initialDraft, notice }: Props) {
  const router = useRouter();
  const handleLocked = useLockedHandler();
  const [list, setList] = useState(() => sortList(initialList));
  const [activeId, setActiveId] = useState<string | null>(initialThread?.meta.conversationId ?? null);
  const [draft, setDraft] = useState<ThreadMeta | null>(initialDraft);
  const [tab, setTab] = useState<ListTab>(() => {
    const c = initialList.find((x) => x.id === initialThread?.meta.conversationId);
    return c?.archived ? "archive" : c?.incomingRequest ? "requests" : "all";
  });
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Vorgeladene Thread-Daten (Server-Render oder gerade erstellter Chat), nur für den ersten Mount. */
  const [preload, setPreload] = useState<Record<string, ThreadData>>(() =>
    initialThread?.meta.conversationId ? { [initialThread.meta.conversationId]: initialThread } : {},
  );
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const itemTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (notice) toast.error(notice);
  }, [notice]);

  /* ---------- URL ---------- */

  const setUrl = (id: string | null, replace = false) => {
    const url = id ? `/dashboard/nachrichten?c=${id}` : "/dashboard/nachrichten";
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  };

  useEffect(() => {
    // ?mit=… nach dem Öffnen durch ?c=… ersetzen
    if (initialThread?.meta.conversationId && new URLSearchParams(location.search).has("mit")) setUrl(initialThread.meta.conversationId, true);
    const onPop = () => {
      const c = new URLSearchParams(location.search).get("c");
      setActiveId(c);
      if (c) setDraft(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [initialThread]);

  const select = (id: string) => {
    if (id === activeId) return;
    setPreload({});
    setDraft(null);
    setActiveId(id);
    setUrl(id);
  };

  const back = () => {
    setPreload({});
    setActiveId(null);
    setDraft(null);
    setUrl(null);
  };

  /* ---------- Liste aktualisieren ---------- */

  const refreshItem = useCallback((id: string) => {
    const timers = itemTimers.current;
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(async () => {
        timers.delete(id);
        const res = await loadConversationItem(id);
        if (!res.ok) {
          if (res.code === "NOT_FOUND") setList((l) => l.filter((c) => c.id !== id));
          return;
        }
        const item = res.data;
        setList((l) => (item ? sortList([...l.filter((c) => c.id !== id), item]) : l.filter((c) => c.id !== id)));
      }, 150),
    );
  }, []);

  /** Header-Zähler (Server-Komponente) nach dem Lesen neu berechnen lassen. */
  const refreshHeader = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 1500);
  }, [router]);

  const onRead = useCallback(
    (id: string) => {
      setList((l) => l.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      refreshHeader();
    },
    [refreshHeader],
  );

  useRealtime((e) => {
    switch (e.type) {
      case "message.new": {
        refreshItem(e.conversationId);
        clearTimeout(typingTimers.current.get(e.conversationId));
        setTyping((t) => ({ ...t, [e.conversationId]: false }));
        const item = list.find((c) => c.id === e.conversationId);
        const visible = document.visibilityState === "visible";
        if ((e.conversationId !== activeId || !visible) && !item?.muted) {
          toast(item ? `Neue Nachricht von ${item.partner.name}` : "Neue Nachricht", {
            description: e.preview,
            action: { label: "Öffnen", onClick: () => select(e.conversationId) },
          });
        }
        break;
      }
      case "message.sent":
      case "message.updated":
      case "conversation.updated":
        refreshItem(e.conversationId);
        break;
      case "message.read":
        if (e.userId === me.id) setList((l) => l.map((c) => (c.id === e.conversationId ? { ...c, unread: 0 } : c)));
        break;
      case "typing":
        if (e.userId === me.id) break;
        setTyping((t) => ({ ...t, [e.conversationId]: true }));
        clearTimeout(typingTimers.current.get(e.conversationId));
        typingTimers.current.set(
          e.conversationId,
          setTimeout(() => setTyping((t) => ({ ...t, [e.conversationId]: false })), 5000),
        );
        break;
      case "presence":
        setList((l) => l.map((c) => (c.partner.id === e.userId ? { ...c, partner: { ...c.partner, online: e.online } } : c)));
        break;
    }
  });

  useEffect(() => {
    const timers = typingTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  /* ---------- Aktionen ---------- */

  const flagFromList = async (id: string, flag: Flag, value: boolean) => {
    const res = await setConversationFlag(id, flag, value);
    if (!res.ok) {
      if (!handleLocked(res)) toast.error(res.error);
      return;
    }
    applyFlag(id, flag, value);
    if (flag === "archived") toast(value ? "Chat archiviert" : "Chat wiederhergestellt");
  };

  const applyFlag = useCallback((id: string, flag: Flag, value: boolean) => {
    setList((l) => sortList(l.map((c) => (c.id === id ? { ...c, [flag]: value } : c))));
  }, []);

  const onCreated = useCallback(
    (id: string, data: ThreadData) => {
      setPreload({ [id]: data });
      setDraft(null);
      setActiveId(id);
      setUrl(id, true);
      refreshItem(id);
    },
    [refreshItem],
  );

  const onChanged = useCallback(
    (id: string, reason?: "accepted") => {
      if (reason === "accepted") {
        setList((l) => l.map((c) => (c.id === id ? { ...c, incomingRequest: false } : c)));
        setTab("all");
      }
      refreshItem(id);
    },
    [refreshItem],
  );

  const onRemoved = useCallback((id: string) => {
    setList((l) => l.filter((c) => c.id !== id));
    setActiveId((a) => (a === id ? null : a));
  }, []);

  const showThread = Boolean(activeId || draft);
  const initialFor = activeId ? (preload[activeId] ?? null) : draft ? { meta: draft, page: { messages: [], nextCursor: null } } : null;

  return (
    <div className="flex h-[calc(100dvh-12.5rem)] min-h-[420px] lg:h-[calc(100dvh-9rem)] overflow-hidden rounded-lg border bg-card">
      <aside className={cn("w-full shrink-0 border-r md:w-[300px] lg:w-[320px]", showThread ? "hidden md:block" : "block")}>
        <ConversationList items={list} activeId={activeId} typing={typing} tab={tab} onTab={setTab} onSelect={select} onFlag={flagFromList} />
      </aside>
      <section className={cn("min-w-0 flex-1", showThread ? "block" : "hidden md:block")}>
        {showThread ? (
          <Thread
            key={activeId ?? `draft:${draft?.partner.id}`}
            me={me}
            conversationId={activeId}
            initial={initialFor}
            onBack={back}
            onCreated={onCreated}
            onFlag={applyFlag}
            onRead={onRead}
            onRemoved={onRemoved}
            onChanged={onChanged}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
            <MessageCircle className="size-10" />
            <p className="text-sm">Wähle einen Chat aus der Liste.</p>
          </div>
        )}
      </section>
    </div>
  );
}
