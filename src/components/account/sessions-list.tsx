"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revokeOtherSessions, revokeSession } from "@/lib/account/actions";

export type SessionRow = { id: string; ip: string | null; userAgent: string | null; createdAt: string; lastUsedAt: string; current: boolean };

/** Grobe Gerätebeschreibung aus dem User-Agent. */
function describe(ua: string | null) {
  if (!ua) return { label: "Unbekanntes Gerät", mobile: false };
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Gerät";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return { label: `${browser} auf ${os}`, mobile: /Mobile|Android|iPhone/.test(ua) };
}

const fmt = (d: string) => new Date(d).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const others = sessions.filter((s) => !s.current).length;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-md border">
        {sessions.map((s) => {
          const d = describe(s.userAgent);
          const Icon = d.mobile ? Smartphone : Monitor;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {d.label} {s.current && <Badge variant="success">Dieses Gerät</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.ip ?? "IP unbekannt"} · zuletzt aktiv {fmt(s.lastUsedAt)} · angemeldet {fmt(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await revokeSession(s.id);
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success("Sitzung beendet");
                        router.refresh();
                      }
                    })
                  }
                >
                  <LogOut /> Abmelden
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others > 0 && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await revokeOtherSessions();
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success(`${res.data.count} Sitzung(en) beendet`);
                  router.refresh();
                }
              })
            }
          >
            <LogOut /> Alle anderen Geräte abmelden
          </Button>
        </div>
      )}
    </div>
  );
}
