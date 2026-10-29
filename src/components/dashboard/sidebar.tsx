"use client";

import { usePathname } from "next/navigation";
import {
  BadgeCheck, Bell, Bookmark, Calendar, CalendarClock, ChartColumn, CirclePlay, Eye, Heart, Images, LayoutDashboard, LifeBuoy, Link2,
  LogOut, MessageCircle, Newspaper, Settings, Shield, SlidersHorizontal, Sparkles, Star, UserPen, type LucideIcon,
} from "lucide-react";
import { LockedLink } from "@/components/shared/profile-lock";
import { logout } from "@/app/(auth)/actions";
import type { NavItem } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, newspaper: Newspaper, "message-circle": MessageCircle, bell: Bell, heart: Heart,
  "sliders-horizontal": SlidersHorizontal, sparkles: Sparkles, bookmark: Bookmark, star: Star, calendar: Calendar, eye: Eye,
  "user-pen": UserPen, images: Images, "circle-play": CirclePlay, "calendar-clock": CalendarClock, "chart-column": ChartColumn,
  link: Link2, "badge-check": BadgeCheck, shield: Shield, settings: Settings, "life-buoy": LifeBuoy,
};

const SECTIONS = { main: "Mein Bereich", provider: "Profil & Angebot", account: "Konto" } as const;

export function DashboardSidebar({ items, complete }: { items: NavItem[]; complete: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const link = (i: NavItem, compact = false) => {
    const Icon = ICONS[i.icon] ?? LayoutDashboard;
    return (
      <LockedLink
        key={i.href}
        href={i.href}
        locked={!complete && !i.free}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
          compact && "w-auto shrink-0 rounded-full border px-3 py-1.5 text-xs",
          active(i.href) && (compact ? "border-foreground bg-foreground text-background hover:bg-foreground" : "bg-accent font-semibold"),
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{i.label}</span>
      </LockedLink>
    );
  };
  return (
    <>
      <nav aria-label="Dashboard" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden [scrollbar-width:none]">
        {items.map((i) => link(i, true))}
      </nav>
      <nav aria-label="Dashboard" className="sticky top-28 hidden flex-col gap-5 lg:flex">
        {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((s) => {
          const list = items.filter((i) => i.section === s);
          if (!list.length) return null;
          return (
            <div key={s} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{SECTIONS[s]}</p>
              {list.map((i) => link(i))}
            </div>
          );
        })}
        <button type="button" onClick={() => logout()} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <LogOut className="size-4" /> Abmelden
        </button>
      </nav>
    </>
  );
}
