import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CategoryNode } from "@/lib/forum/types";
import { ForumSidebar } from "./forum-sidebar";

export type Crumb = { label: string; href?: string };

/** Zwei-Spalten-Layout des Forums (Sidebar + Hauptspalte mit Breadcrumb). */
export function ForumShell({ tree, active, query, crumbs, children }: { tree: CategoryNode[]; active: string | null; query?: string | null; crumbs: Crumb[]; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="order-2 lg:order-1">
        <div className="lg:sticky lg:top-28">
          <ForumSidebar tree={tree} active={active} query={query} />
        </div>
      </aside>
      <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
        <Breadcrumb crumbs={crumbs} />
        {children}
      </div>
    </div>
  );
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Brotkrumen" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3" />}
          {c.href ? (
            <Link href={c.href} className="hover:text-foreground hover:underline">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
