"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, Lock, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MessageView, ThreadData, ThreadMeta } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import {
  deleteMessage,
  editMessage,
  loadBookingMessages,
  loadMessages,
  loadMeta,
  loadOlder,
  loadThread,
  markRead,
  reactToMessage,
  sendMessage,
} from "@/app/(site)/dashboard/nachrichten/actions";
import { acceptRequest, blockUser, declineRequest, setConversationFlag, unblockUser } from "@/app/(site)/dashboard/nachrichten/conversation-actions";
import { Composer, type SendInput } from "./composer";
import { dayLabel, sameDay } from "./format";
import { MessageBubble, type TickState } from "./message-bubble";
import { ThreadHeader } from "./thread-header";
import { sendRealtime, useNow, useRealtime } from "./use-realtime";

type Flag = "pinned" | "archived" | "muted";

export type ThreadProps = {
  me: { id: string; name: string };
  conversationId: string | null;
  initial: ThreadData | null;
  onBack: () => void;
  onCreated: (conversationId: string, data: ThreadData) => void;
  onFlag: (conversationId: string, flag: Flag, value: boolean) => void;
  onRead: (conversationId: string) => void;
  onRemoved: (conversationId: string) => void;
};

function upsert(list: MessageView[], items: MessageView[]) {
  const map = new Map(list.map((m) => [m.id, m]));
  for (const m of items) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function Thread({ me, conversationId, initial, onBack, onCreated, onFlag, onRead, onRemoved }: ThreadProps) {
  const handleLocked = useLockedHandler();
  const [meta, setMeta] = useState<ThreadMeta | null>(initial?.meta ?? null);
  const [messages, setMessages] = useState<MessageView[]>(initial?.page.messages ?? []);
  const [cursor, setCursor] = useState<string | null>(initial?.page.nextCursor ?? null);
  const [loading, setLoading] = useState(!initial);
  const [older, setOlder] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const now = useNow();
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [editing, setEditing] = useState<MessageView | null>(null);
  const [toDelete, setToDelete] = useState<MessageView | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastRead = useRef<string>("");

  const fail = useCallback(
    (res: { ok: false; code: string; error: string }) => {
      if (!handleLocked(res)) toast.error(res.error);
    },
    [handleLocked],
  );

  // Laden, falls nicht vom Server mitgeliefert
  const preloaded = useRef(Boolean(initial));
  useEffect(() => {
    if (preloaded.current || !conversationId) return;
    let cancelled = false;
    loadThread(conversationId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        fail(res);
        onRemoved(conversationId);
        return;
      }
      setMeta(res.data.meta);
      setMessages(res.data.page.messages);
      setCursor(res.data.page.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, fail, onRemoved]);

  /* ---------- Scrollen ---------- */

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stickBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, typing, loading]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && cursor && !older) fetchOlder();
  };

  const fetchOlder = async () => {
    if (!conversationId || !cursor || older) return;
    setOlder(true);
    const res = await loadOlder(conversationId, cursor);
    setOlder(false);
    if (!res.ok) return fail(res);
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    setMessages((list) => upsert(list, res.data.messages));
    setCursor(res.data.nextCursor);
  };

  /* ---------- Gelesen ---------- */

  const scheduleRead = useCallback(() => {
    if (!conversationId) return;
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await markRead(conversationId);
      if (res.ok) onRead(conversationId);
    }, 400);
  }, [conversationId, onRead]);

  useEffect(() => {
    const latest = [...messages].reverse().find((m) => m.senderId !== me.id);
    if (!latest || latest.id === lastRead.current) return;
    lastRead.current = latest.id;
    scheduleRead();
  }, [messages, me.id, scheduleRead]);

  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && lastRead.current && scheduleRead();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(readTimer.current);
    };
  }, [scheduleRead]);

  /* ---------- Echtzeit ---------- */

  const refetch = useCallback(
    async (ids: string[]) => {
      if (!conversationId || ids.length === 0) return;
      const res = await loadMessages(conversationId, ids);
      if (res.ok) setMessages((list) => upsert(list, res.data));
    },
    [conversationId],
  );

  const refreshMeta = useCallback(async () => {
    if (!conversationId) return;
    const res = await loadMeta(conversationId);
    if (res.ok && res.data) setMeta(res.data);
  }, [conversationId]);

  useRealtime((e) => {
    if (!meta) return;
    if (e.type === "presence" && e.userId === meta.partner.id) {
      setMeta({ ...meta, partner: { ...meta.partner, online: e.online, lastSeenAt: e.online ? meta.partner.lastSeenAt : new Date().toISOString() } });
      return;
    }
    if (e.type === "booking.updated" && conversationId && e.conversationId === conversationId) {
      loadBookingMessages(conversationId, e.bookingId).then((res) => res.ok && setMessages((list) => upsert(list, res.data)));
      return;
    }
    if (!("conversationId" in e) || e.conversationId !== conversationId) return;
    switch (e.type) {
      case "message.new":
        clearTimeout(typingTimer.current);
        setTyping(false);
        refetch([e.messageId]);
        if (meta.outgoingRequest) refreshMeta();
        break;
      case "message.sent":
        if (!messages.some((m) => m.id === e.messageId)) refetch([e.messageId]);
        break;
      case "message.updated":
        refetch([e.messageId]);
        break;
      case "message.delivered": {
        const ids = new Set(e.messageIds);
        setMessages((list) => list.map((m) => (ids.has(m.id) && !m.deliveredAt ? { ...m, deliveredAt: e.at } : m)));
        break;
      }
      case "message.read":
        if (e.userId === meta.partner.id && meta.receipts) setMeta({ ...meta, partnerLastReadAt: e.at });
        break;
      case "typing":
        if (e.userId === meta.partner.id) {
          setTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 5000);
        }
        break;
      case "conversation.updated":
        refreshMeta();
        break;
    }
  });

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  /* ---------- Aktionen ---------- */

  const send = async (input: SendInput) => {
    if (!meta) return false;
    stickBottom.current = true;
    const res = await sendMessage({
      conversationId: conversationId ?? undefined,
      toUserId: conversationId ? undefined : meta.partner.id,
      body: input.body,
      attachments: input.attachments,
      replyToId: replyTo?.id,
    });
    if (!res.ok) {
      fail(res);
      if (res.code === "FORBIDDEN") refreshMeta();
      return false;
    }
    setReplyTo(null);
    if (!conversationId) {
      const isRequest = meta.canSend.ok && meta.canSend.isNewRequest;
      onCreated(res.data.conversationId, {
        meta: { ...meta, conversationId: res.data.conversationId, outgoingRequest: isRequest, canSend: { ok: true, isNewRequest: false } },
        page: { messages: [res.data.message], nextCursor: null },
      });
    } else {
      setMessages((list) => upsert(list, [res.data.message]));
    }
    return true;
  };

  const saveEdit = async (body: string) => {
    if (!editing) return false;
    const res = await editMessage(editing.id, body);
    if (!res.ok) {
      fail(res);
      return false;
    }
    setMessages((list) => upsert(list, [res.data]));
    setEditing(null);
    return true;
  };

  const react = async (m: MessageView, emoji: string) => {
    const res = await reactToMessage(m.id, emoji);
    if (!res.ok) return fail(res);
    setMessages((list) => upsert(list, [res.data]));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await deleteMessage(toDelete.id);
    setToDelete(null);
    if (!res.ok) return fail(res);
    setMessages((list) => upsert(list, [res.data]));
  };

  const jump = (id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return toast("Die Nachricht ist weiter oben im Verlauf");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(id);
    setTimeout(() => setHighlight(null), 1500);
  };

  const flag = async (f: Flag, value: boolean) => {
    if (!conversationId || !meta) return;
    const res = await setConversationFlag(conversationId, f, value);
    if (!res.ok) return fail(res);
    setMeta({ ...meta, [f]: value });
    onFlag(conversationId, f, value);
  };

  const block = async () => {
    if (!meta) return;
    const res = await blockUser(meta.partner.id);
    if (!res.ok) return fail(res);
    toast.success(`${meta.partner.name} ist blockiert`);
    refreshMeta();
  };

  const unblock = async () => {
    if (!meta) return;
    const res = await unblockUser(meta.partner.id);
    if (!res.ok) return fail(res);
    toast.success("Blockierung aufgehoben");
    refreshMeta();
  };

  const request = async (action: "accept" | "decline") => {
    if (!conversationId || !meta) return;
    const res = action === "accept" ? await acceptRequest(conversationId) : await declineRequest(conversationId);
    if (!res.ok) return fail(res);
    if (action === "accept") setMeta({ ...meta, incomingRequest: false });
    else {
      toast("Anfrage abgelehnt und archiviert");
      onFlag(conversationId, "archived", true);
      onBack();
    }
  };

  /* ---------- Darstellung ---------- */

  if (loading || !meta) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const nameOf = (id: string) => (id === me.id ? "Du" : id === meta.partner.id ? meta.partner.name : "Unbekannt");
  const readAt = meta.receipts && meta.partnerLastReadAt ? meta.partnerLastReadAt : null;
  const tickFor = (m: MessageView): TickState | null => {
    if (m.senderId !== me.id) return null;
    if (readAt && readAt >= m.createdAt) return "read";
    return m.deliveredAt ? "delivered" : "sent";
  };
  const lastPartnerMsg = [...messages].reverse().find((m) => m.senderId === meta.partner.id && !m.deletedAt);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadHeader meta={meta} typing={typing} reportMessageId={lastPartnerMsg?.id ?? null} onBack={onBack} onFlag={flag} onBlock={block} onUnblock={unblock} />

      {meta.incomingRequest && (
        <div className="flex flex-col gap-2 border-b bg-primary/10 px-4 py-3 text-sm sm:flex-row sm:items-center">
          <p className="flex-1">
            <strong>{meta.partner.name}</strong> möchte mit dir chatten. Antworte oder nimm die Anfrage an. Bis dahin sieht {meta.partner.name} nicht, ob du gelesen hast.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => request("accept")}>
              Annehmen
            </Button>
            <Button size="sm" variant="secondary" onClick={() => request("decline")}>
              Ablehnen
            </Button>
          </div>
        </div>
      )}

      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3 sm:px-4">
        {cursor && (
          <div className="flex justify-center py-1">
            <Button variant="ghost" size="sm" onClick={fetchOlder} disabled={older}>
              {older && <Loader2 className="animate-spin" />} Ältere Nachrichten laden
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="m-auto flex max-w-xs flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <UserAvatar user={meta.partner} size="lg" />
            <p>
              {meta.canSend.ok ? (
                <>
                  Schreib <strong className="text-foreground">{meta.partner.name}</strong> die erste Nachricht.
                </>
              ) : (
                <>Noch keine Nachrichten.</>
              )}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            {(i === 0 || !sameDay(messages[i - 1]!.createdAt, m.createdAt)) && (
              <div className="my-2 self-center rounded-full bg-secondary px-3 py-0.5 text-[11px] font-medium text-muted-foreground">{dayLabel(m.createdAt)}</div>
            )}
            <MessageBubble
              m={m}
              mine={m.senderId === me.id}
              viewerId={me.id}
              tick={tickFor(m)}
              now={now}
              nameOf={nameOf}
              highlighted={highlight === m.id}
              onReply={(x) => {
                setEditing(null);
                setReplyTo(x);
              }}
              onEdit={(x) => {
                setReplyTo(null);
                setEditing(x);
              }}
              onDelete={setToDelete}
              onReact={react}
              onJump={jump}
              onRefresh={(x) => refetch([x.id])}
            />
          </Fragment>
        ))}
        {typing && (
          <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-secondary px-3 py-2.5" aria-label={`${meta.partner.name} schreibt`}>
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>

      <Footer
        meta={meta}
        composer={
          <Composer
            key={conversationId ?? "draft"}
            replyTo={replyTo}
            editing={editing}
            nameOf={nameOf}
            onCancelReply={() => setReplyTo(null)}
            onCancelEdit={() => setEditing(null)}
            onSend={send}
            onSaveEdit={saveEdit}
            onTyping={() => conversationId && sendRealtime({ type: "typing", conversationId })}
          />
        }
        onUnblock={unblock}
      />

      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nachricht für beide löschen?</DialogTitle>
            <DialogDescription>Die Nachricht wird bei dir und bei {meta.partner.name} durch „Nachricht gelöscht“ ersetzt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Eingabe oder Hinweis, warum nicht geschrieben werden kann (Connect, Blockierung, Limit). */
function Footer({ meta, composer, onUnblock }: { meta: ThreadMeta; composer: React.ReactNode; onUnblock: () => void }) {
  if (meta.blockedByMe) {
    return (
      <div className="flex flex-col items-center gap-2 border-t bg-card px-4 py-4 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
        <p className="flex-1">Du hast {meta.partner.name} blockiert. Ihr könnt euch keine Nachrichten schreiben.</p>
        <Button size="sm" variant="secondary" onClick={onUnblock}>
          Blockierung aufheben
        </Button>
      </div>
    );
  }
  if (!meta.canSend.ok) {
    const booking = meta.canSend.bookingHref;
    return (
      <div className={cn("flex flex-col items-center gap-3 border-t bg-card px-4 py-4 text-center text-sm sm:flex-row sm:text-left")}>
        {meta.canSend.code === "CONNECT_OFF" || meta.canSend.code === "CONNECT_RULE" ? (
          <CalendarDays className="size-5 shrink-0 text-primary" />
        ) : (
          <Lock className="size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1">
          <p className="font-semibold">{meta.canSend.message}</p>
          {meta.canSend.code === "CONNECT_OFF" && <p className="text-xs text-muted-foreground">Neue Nachrichten an {meta.partner.name} sind nur über eine Buchungsanfrage möglich.</p>}
        </div>
        {booking && (
          <Button size="sm" asChild>
            <Link href={booking}>
              <CalendarDays /> Termin anfragen
            </Link>
          </Button>
        )}
      </div>
    );
  }
  const requestNote = meta.outgoingRequest || (!meta.conversationId && meta.canSend.isNewRequest);
  return (
    <>
      {requestNote && (
        <p className="flex items-center gap-2 border-t bg-card px-4 pt-2 text-xs text-muted-foreground">
          <MessageCircle className="size-3.5" /> Deine Nachricht ist eine Anfrage, bis {meta.partner.name} antwortet.
        </p>
      )}
      {composer}
    </>
  );
}
