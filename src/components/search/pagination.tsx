import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Seitennavigation (Server-Komponente). */
export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const item = "flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-medium transition-colors";
  return (
    <nav aria-label="Seiten" className="flex items-center justify-center gap-1.5 pt-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "hover:border-foreground")} aria-label="Vorherige Seite">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - sorted[i - 1]! > 1 && <span className="text-xs text-muted-foreground">…</span>}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "hover:border-foreground")} aria-label="Nächste Seite">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
