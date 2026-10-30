"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Icon mit Beschriftung und Zähler; der Zähler wird über das Realtime-Event live erhöht. */
export function HeaderIcon({
  href,
  label,
  count = 0,
  live,
  children,
}: {
  href: string;
  label: string;
  count?: number;
  live?: "messages" | "notifications";
  children: React.ReactNode;
}) {
  // Live-Zähler: Serverwert plus Ereignisse seit dem letzten Render; neuer Serverwert setzt zurück.
  const [live_, setLive] = useState({ base: count, extra: 0 });
  if (live_.base !== count) setLive({ base: count, extra: 0 });
  const n = count + live_.extra;
  useEffect(() => {
    if (!live) return;
    const onEvent = (e: Event) => {
      const type = (e as CustomEvent<{ type: string }>).detail?.type;
      if (live === "messages" && type === "message.new") setLive((s) => ({ ...s, extra: s.extra + 1 }));
      if (live === "notifications" && type === "notification") setLive((s) => ({ ...s, extra: s.extra + 1 }));
    };
    window.addEventListener("pp:realtime", onEvent);
    return () => window.removeEventListener("pp:realtime", onEvent);
  }, [live]);
  return (
    <Link href={href} className="relative flex flex-col items-center gap-0.5 px-2 text-[10px] text-muted-foreground hover:text-foreground [&_svg]:size-5">
      <span className="relative text-foreground">
        {children}
        {n > 0 && (
          <span className={cn("absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white")}>
            {n > 99 ? "99+" : n}
          </span>
        )}
      </span>
      <span className="hidden sm:block">{label}</span>
    </Link>
  );
}
