import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Einfache Seitennavigation über den Suchparameter «seite». */
export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  params,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "seite") sp.set(k, v);
    if (p > 1) sp.set("seite", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const cls = "inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs hover:bg-accent";
  return (
    <nav aria-label="Seiten" className="flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
      <span>
        Seite {page} von {pages} · {total} Einträge
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cls}>
            <ChevronLeft className="size-3.5" /> Zurück
          </Link>
        ) : (
          <span className={cn(cls, "pointer-events-none opacity-40")}>
            <ChevronLeft className="size-3.5" /> Zurück
          </span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={cls}>
            Weiter <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          <span className={cn(cls, "pointer-events-none opacity-40")}>
            Weiter <ChevronRight className="size-3.5" />
          </span>
        )}
      </span>
    </nav>
  );
}
