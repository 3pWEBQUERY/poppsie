"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname + (params.toString() ? `?${params}` : "");
  const isActive = (href: string) => {
    if (href.includes("?")) return current === href;
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/suche") return pathname === "/suche" && !params.get("typ");
    return pathname === href || (pathname.startsWith(href + "/") && href !== "/");
  };
  return (
    <nav className="mx-auto flex h-9 max-w-6xl items-center gap-6 overflow-x-auto px-4 text-xs font-medium [scrollbar-width:none]">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "relative flex h-full shrink-0 items-center whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            isActive(l.href) && "font-semibold text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
