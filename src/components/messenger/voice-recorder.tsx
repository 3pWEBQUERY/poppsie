"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { duration } from "./format";

const MAX_SEC = 300;

function pickMime() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

/** Sprachnachricht über MediaRecorder; liefert eine Audiodatei inkl. Dauer. */
export function VoiceRecorder({ disabled, onRecorded, onActiveChange }: { disabled?: boolean; onRecorded: (file: File, seconds: number) => void; onActiveChange?: (active: boolean) => void }) {
  const [active, setActive] = useState(false);
  const [sec, setSec] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => onActiveChange?.(active), [active, onActiveChange]);
  useEffect(
    () => () => {
      clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Dein Browser unterstützt keine Sprachaufnahmen");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelled.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timer.current);
        setActive(false);
        if (cancelled.current) return;
        const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        const type = (r.mimeType || mime || "audio/webm").split(";")[0]!;
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunks.current, { type });
        if (blob.size < 500) {
          toast.error("Aufnahme zu kurz");
          return;
        }
        onRecorded(new File([blob], `sprachnachricht.${ext}`, { type }), seconds);
      };
      rec.current = r;
      r.start(250);
      started.current = Date.now();
      setSec(0);
      setActive(true);
      timer.current = setInterval(() => {
        const s = Math.round((Date.now() - started.current) / 1000);
        setSec(s);
        if (s >= MAX_SEC) r.stop();
      }, 250);
    } catch {
      toast.error("Kein Zugriff auf das Mikrofon");
    }
  };

  const stop = (cancel: boolean) => {
    cancelled.current = cancel;
    if (rec.current?.state === "recording") rec.current.stop();
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label="Sprachnachricht aufnehmen"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <Mic className="size-5" />
      </button>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-3 rounded-md border border-primary/50 bg-background px-3 py-1.5" role="status" aria-live="polite">
      <span className="size-2.5 animate-pulse rounded-full bg-primary" aria-hidden />
      <span className="text-sm tabular-nums">{duration(sec)}</span>
      <span className="text-xs text-muted-foreground">Aufnahme läuft …</span>
      <button type="button" onClick={() => stop(true)} aria-label="Aufnahme verwerfen" className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
        <Trash2 className="size-4" />
      </button>
      <button type="button" onClick={() => stop(false)} aria-label="Sprachnachricht senden" className="rounded-md bg-primary p-1.5 text-white hover:bg-primary-hover">
        <Send className="size-4" />
      </button>
    </div>
  );
}
