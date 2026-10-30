"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CalendarDays, CheckCheck, Heart, MessageCircle, ShieldAlert, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/account/actions";
import { cn } from "@/lib/utils";

export type NotificationRow = { id: string; type: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

function iconFor(type: string) {
  if (type.startsWith("moderation")) return ShieldAlert;
  if (type.startsWith("booking")) return CalendarDays;
  if (type.startsWith("message")) return MessageCircle;
  if (type.startsWith("review")) return Star;
  if (type.startsWith("favorite") || type.startsWith("follow")) return Heart;
  return Bell;
}

function when(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return d.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

/** Mitteilungen mit Ungelesen-Status; neue Einträge erscheinen live über das Realtime-Event. */
export function NotificationList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [fresh, setFresh] = useState(0);
  const [pending, start] = useTransition();

  // Neue Server-Daten (router.refresh) übernehmen
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setRows(items);
    setFresh(0);
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string }>).detail;
      if (detail?.type !== "notification") return;
      setFresh((n) => n + 1);
      // Kurz bündeln, falls mehrere Ereignisse gleichzeitig eintreffen
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    window.addEventListener("pp:realtime", onEvent);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pp:realtime", onEvent);
    };
  }, [router]);

  const unread = rows.filter((r) => !r.readAt).length;

  const safeHref = (h: string | null) => (h && h.startsWith("/") && !h.startsWith("//") ? h : null);

  const open = (n: NotificationRow) => {
    const href = safeHref(n.href);
    if (!n.readAt) {
      setRows((r) => r.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      start(async () => {
        await markNotificationRead(n.id);
        if (href) router.push(href);
        router.refresh();
      });
    } else if (href) router.push(href);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread ? `${unread} ungelesen` : "Alles gelesen"}
          {fresh > 0 && <span className="ml-2 inline-flex items-center gap-1 text-primary"><BellRing className="size-3.5" /> neu</span>}
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || unread === 0}
          onClick={() =>
            start(async () => {
              const res = await markAllNotificationsRead();
              if (!res.ok) toast.error(res.error);
              else {
                setRows((r) => r.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
                router.refresh();
              }
            })
          }
        >
          <CheckCheck /> Alle als gelesen markieren
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-14 text-center">
          <Bell className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Noch keine Mitteilungen. Hier erscheinen Buchungen, Berichte, neue Follower und Hinweise vom Team.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
          {rows.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent", !n.readAt && "bg-primary/5")}
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary", !n.readAt && "text-primary")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.readAt ? "font-bold" : "font-medium")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-3 block text-sm whitespace-pre-line text-muted-foreground">{n.body}</span>}
                    <span suppressHydrationWarning className="mt-1 block text-[11px] text-muted-foreground">
                      {when(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && <span aria-label="Ungelesen" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
