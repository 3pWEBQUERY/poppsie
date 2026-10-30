"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLockedHandler } from "@/components/shared/profile-lock";
import { recordProfileVisit, toggleFollow } from "@/lib/profiles/social-actions";
import { cn } from "@/lib/utils";

/** Erfasst den Profilbesuch nach dem Rendern im Browser (Prefetches zählen so nicht mit). */
export function VisitTracker({ targetId, src }: { targetId: string; src?: string | null }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void recordProfileVisit(targetId, src ?? null);
  }, [targetId, src]);
  return null;
}

export function FollowButton({ targetId, initial, loggedIn, className }: { targetId: string; initial: boolean; loggedIn: boolean; className?: string }) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  const handleLocked = useLockedHandler();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "secondary" : "outline"}
      aria-pressed={following}
      disabled={pending}
      className={className}
      onClick={() => {
        if (!loggedIn) return router.push(`/anmelden?next=${encodeURIComponent(window.location.pathname)}`);
        start(async () => {
          const res = await toggleFollow(targetId);
          if (res.ok) setFollowing(res.data.following);
          else if (!handleLocked(res)) toast.error(res.error);
        });
      }}
    >
      {following ? <UserCheck /> : <UserPlus />}
      {following ? "Folge ich" : "Folgen"}
    </Button>
  );
}

/** Pillen-Tabs für Profilseiten; Inhalte werden serverseitig gerendert und hereingereicht. */
export function ProfileTabs({ tabs, className }: { tabs: { value: string; label: string; count?: number; content: React.ReactNode }[]; className?: string }) {
  return (
    <Tabs defaultValue={tabs[0]?.value} className={cn("gap-4", className)}>
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="h-8 px-4 text-xs">
            {t.label}
            {t.count != null && <span className="text-[10px] opacity-70">{t.count}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} forceMount className="data-[state=inactive]:hidden">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * Sticky Infospalte: ist sie höher als das Fenster, klebt sie mit ihrer Unterkante,
 * sonst oben (unter dem Header). So bleibt jeder Teil erreichbar.
 */
export function StickyAside({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState(96);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(96, window.innerHeight - el.offsetHeight - 16));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <aside ref={ref} style={{ "--aside-top": `${top}px` } as React.CSSProperties} className={cn("lg:sticky lg:top-[var(--aside-top)] lg:self-start", className)}>
      {children}
    </aside>
  );
}
