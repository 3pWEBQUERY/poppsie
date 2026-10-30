"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Tabs einer Gruppe: Feed, Forum, Mitglieder, Info (+ Verwalten). */
export function GroupTabs({ slug, admin, badge }: { slug: string; admin: boolean; badge?: number }) {
  const path = usePathname();
  const base = `/gruppen/${slug}`;
  const tabs = [
    { href: base, label: "Feed" },
    { href: `${base}/forum`, label: "Forum" },
    { href: `${base}/mitglieder`, label: "Mitglieder" },
    { href: `${base}/info`, label: "Info" },
    ...(admin ? [{ href: `${base}/verwalten`, label: "Verwalten" }] : []),
  ];
  return (
    <nav aria-label="Gruppenbereiche" className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = t.href === base ? path === base : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3 pb-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground",
              active && "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary",
            )}
          >
            {t.label}
            {t.label === "Verwalten" && badge ? <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
