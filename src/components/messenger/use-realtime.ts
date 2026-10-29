"use client";

import { useEffect, useRef, useState } from "react";

/** Ereignisse vom WebSocket (siehe RealtimeBridge). */
export type RtEvent =
  | { type: "message.new"; conversationId: string; messageId: string; senderId: string; preview?: string }
  | { type: "message.sent"; conversationId: string; messageId: string; senderId: string }
  | { type: "message.updated"; conversationId: string; messageId: string }
  | { type: "message.delivered"; conversationId: string; messageIds: string[]; at: string }
  | { type: "message.read"; conversationId: string; userId: string; at: string }
  | { type: "conversation.updated"; conversationId: string }
  | { type: "typing"; conversationId: string; userId: string }
  | { type: "booking.updated"; bookingId: string; conversationId?: string | null }
  | { type: "presence"; userId: string; online: boolean };

/** Hört auf "pp:realtime"; der Handler darf sich bei jedem Render ändern. */
export function useRealtime(handler: (e: RtEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const on = (e: Event) => {
      const detail = (e as CustomEvent<RtEvent>).detail;
      if (detail && typeof detail === "object" && "type" in detail) ref.current(detail);
    };
    window.addEventListener("pp:realtime", on);
    return () => window.removeEventListener("pp:realtime", on);
  }, []);
}

export function sendRealtime(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("pp:send", { detail }));
}

/** Aktuelle Zeit, alle `intervalMs` aktualisiert (z. B. für das 15-Minuten-Bearbeitungsfenster). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
