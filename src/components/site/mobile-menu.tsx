"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileMenu({ links, label }: { links: { href: string; label: string }[]; label: string }) {
  return (
    <Sheet>
      <SheetTrigger className="flex flex-col items-center gap-0.5 px-2 text-[10px] text-muted-foreground hover:text-foreground md:hidden">
        <Menu className="size-5 text-foreground" />
        <span className="hidden sm:block">{label}</span>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col px-2">
          {links.map((l) => (
            <SheetClose asChild key={l.href}>
              <Link href={l.href} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent">
                {l.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
