"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, MessagesSquare, Search } from "lucide-react";
import type { CategoryNode } from "@/lib/forum/types";
import { cn } from "@/lib/utils";

/** Linke Spalte: aufklappbarer Kategorienbaum mit Häkchen beim aktiven Unterforum und Suche. */
export function ForumSidebar({ tree, active, query }: { tree: CategoryNode[]; active: string | null; query?: string | null }) {
  const initiallyOpen = new Set(tree.filter((t) => t.slug === active || t.children.some((c) => c.slug === active)).map((t) => t.id));
  const [open, setOpen] = useState<Set<string>>(initiallyOpen.size ? initiallyOpen : new Set(tree.slice(0, 1).map((t) => t.id)));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <nav aria-label="Forum-Kategorien" className="flex flex-col gap-3">
      <form action="/forum" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Forum durchsuchen …"
          aria-label="Forum durchsuchen"
          className="h-9 w-full rounded-md border border-input bg-card pr-2 pl-8 text-sm outline-none focus-visible:border-ring"
        />
      </form>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Link
          href="/forum"
          className={cn("flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold hover:bg-accent", !active && !query && "text-primary")}
        >
          <MessagesSquare className="size-4" /> Forum-Übersicht
          {!active && !query && <Check className="ml-auto size-4" />}
        </Link>
        <ul>
          {tree.map((t) => {
            const isOpen = open.has(t.id);
            return (
              <li key={t.id} className="border-b last:border-b-0">
                <div className="flex items-center">
                  {t.children.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      aria-expanded={isOpen}
                      aria-label={`${t.name} ${isOpen ? "zuklappen" : "aufklappen"}`}
                      className="flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  ) : (
                    <span className="size-9 shrink-0" />
                  )}
                  <Link
                    href={`/forum/${t.slug}`}
                    className={cn("flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 text-sm font-semibold hover:text-primary", active === t.slug && "text-primary")}
                  >
                    <span className="truncate">{t.name}</span>
                    {active === t.slug ? <Check className="ml-auto size-4 shrink-0" /> : <span className="ml-auto text-[11px] font-normal text-muted-foreground">{t.threadCount}</span>}
                  </Link>
                </div>
                {isOpen && t.children.length > 0 && (
                  <ul className="pb-1.5">
                    {t.children.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/forum/${c.slug}`}
                          aria-current={active === c.slug ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2 py-1.5 pr-3 pl-9 text-[13px] text-muted-foreground hover:text-foreground",
                            active === c.slug && "font-semibold text-foreground",
                          )}
                        >
                          <span className="truncate">{c.name}</span>
                          {active === c.slug ? <Check className="ml-auto size-4 shrink-0 text-primary" /> : <span className="ml-auto text-[11px]">{c.threadCount}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
