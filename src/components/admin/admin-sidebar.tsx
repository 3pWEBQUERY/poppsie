"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Building2, Flag, MessagesSquare, Scale, ScrollText, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Counts = { flags: number; urgent: number; appeals: number; kyc: number };

const ITEMS: { href: string; label: string; icon: LucideIcon; count?: keyof Counts }[] = [
  { href: "/admin", label: "Meldungen", icon: Flag, count: "flags" },
  { href: "/admin/einsprueche", label: "Einsprüche", icon: Scale, count: "appeals" },
  { href: "/admin/kyc", label: "Verifikation (KYC)", icon: BadgeCheck, count: "kyc" },
  { href: "/admin/benutzer", label: "Benutzer", icon: Users },
  { href: "/admin/audit", label: "Audit-Log", icon: ScrollText },
  { href: "/admin/club-typen", label: "Club-Typen", icon: Building2 },
  { href: "/admin/forum", label: "Forum", icon: MessagesSquare },
];

export function AdminSidebar({ counts, role }: { counts: Counts; role: "admin" | "moderator" }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/meldungen") : pathname.startsWith(href));
  const badge = (i: (typeof ITEMS)[number]) => {
    const n = i.count ? counts[i.count] : 0;
    if (!n) return null;
    const urgent = i.count === "flags" && counts.urgent > 0;
    return (
      <span className={cn("ml-auto rounded-full px-1.5 text-[10px] font-bold leading-4", urgent ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}>
        {n > 99 ? "99+" : n}
      </span>
    );
  };
  return (
    <>
      <nav aria-label="Administration" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden [scrollbar-width:none]">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
              active(i.href) ? "border-foreground bg-foreground text-background" : "hover:bg-accent",
            )}
          >
            <i.icon className="size-3.5" /> {i.label}
            {badge(i)}
          </Link>
        ))}
      </nav>
      <nav aria-label="Administration" className="sticky top-20 hidden flex-col gap-0.5 lg:flex">
        <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {role === "admin" ? "Administration" : "Moderation"}
        </p>
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active(i.href) ? "page" : undefined}
            className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent", active(i.href) && "bg-accent font-semibold")}
          >
            <i.icon className="size-4 shrink-0" />
            <span className="truncate">{i.label}</span>
            {badge(i)}
          </Link>
        ))}
        {counts.urgent > 0 && (
          <Link href="/admin?status=active" className="mt-3 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-xs text-foreground">
            <span className="font-bold text-primary">{counts.urgent} dringend</span>
            <span className="block text-muted-foreground">Minderjährigkeit, Zwang oder Menschenhandel</span>
          </Link>
        )}
      </nav>
    </>
  );
}
