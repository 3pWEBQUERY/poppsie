"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Eine WebSocket-Verbindung pro Tab (/ws, Session-Cookie). Ereignisse werden als
 * window-Event "pp:realtime" verteilt; Komponenten wie Messenger und Header hören darauf.
 * Senden: window.dispatchEvent(new CustomEvent("pp:send", { detail: {...} })).
 */
export function RealtimeBridge() {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry = 0;
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          window.dispatchEvent(new CustomEvent("pp:realtime", { detail: event }));
          if (event.type === "notification" && !location.pathname.startsWith("/dashboard/mitteilungen")) toast(event.title);
        } catch {}
      };
      ws.onclose = () => {
        if (closed) return;
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
      };
    };
    const send = (e: Event) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify((e as CustomEvent).detail));
    };
    connect();
    window.addEventListener("pp:send", send);
    return () => {
      closed = true;
      clearTimeout(timer);
      window.removeEventListener("pp:send", send);
      ws?.close();
    };
  }, []);
  return null;
}
