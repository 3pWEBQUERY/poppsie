import Link from "next/link";
import { BadgeCheck, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Lock, MessageSquare, Pin } from "lucide-react";
import { RelativeTime } from "@/components/content/relative-time";
import { UserAvatar } from "@/components/shared/user-avatar";
import { SORT_LABELS, type ThreadListItem, type ThreadSort } from "@/lib/forum/types";
import { cn } from "@/lib/utils";

export function ThreadBadges({ t, className }: { t: Pick<ThreadListItem, "pinned" | "locked" | "solved" | "prefix">; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1 align-middle", className)}>
      {t.pinned && (
        <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
          <Pin className="size-3" /> Angepinnt
        </span>
      )}
      {t.solved && (
        <span className="inline-flex items-center gap-0.5 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success uppercase">
          <CheckCircle2 className="size-3" /> Gelöst
        </span>
      )}
      {t.locked && (
        <span className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
          <Lock className="size-3" /> Geschlossen
        </span>
      )}
      {t.prefix && <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.prefix}</span>}
    </span>
  );
}

/** Themenliste wie im JOYclub-Forum: Kategorie, Autor, Datum, Titel, Auszug, Vorschaubild, letzte Antwort. */
export function ThreadList({ items, empty = "Noch keine Themen." }: { items: ThreadListItem[]; empty?: string }) {
  if (!items.length) return <p className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
      {items.map((t) => (
        <li key={t.id} className={cn("relative flex gap-4 p-4 transition-colors hover:bg-accent/40", t.pinned && "bg-primary/5")}>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <Link href={`/forum/${t.category.slug}`} className="relative z-10 font-semibold text-primary hover:underline">
                {t.category.name}
              </Link>
              <span>·</span>
              <UserAvatar user={t.author} size="xs" className="size-5" />
              <Link href={t.author.href} className="relative z-10 font-medium text-foreground hover:underline">
                {t.author.name}
              </Link>
              {t.author.verified && <BadgeCheck className="size-3.5 text-primary" />}
              <span>·</span>
              <RelativeTime iso={t.createdAt} />
            </div>
            <h3 className="text-[15px] leading-snug font-bold">
              <ThreadBadges t={t} className="mr-1.5" />
              <Link href={`/forum/thread/${t.id}`} className="after:absolute after:inset-0 hover:text-primary">
                {t.title}
              </Link>
              {t.unread && <span className="ml-1.5 inline-block size-2 rounded-full bg-primary align-middle" aria-label="Ungelesen" />}
            </h3>
            {t.excerpt && <p className="line-clamp-2 text-[13px] text-muted-foreground">{t.excerpt}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3.5" /> {t.replyCount} {t.replyCount === 1 ? "Antwort" : "Antworten"}
              </span>
              {t.hasPoll && (
                <span className="inline-flex items-center gap-1">
                  <BarChart3 className="size-3.5" /> Umfrage
                </span>
              )}
              {t.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                  #{tag}
                </span>
              ))}
              {t.lastReply && (
                <span className="ml-auto inline-flex items-center gap-1">
                  Letzte Antwort von <span className="font-medium text-foreground">{t.lastReply.author.name}</span> <RelativeTime iso={t.lastReply.at} />
                </span>
              )}
            </div>
          </div>
          {t.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.thumbUrl} alt="" loading="lazy" className="hidden size-20 shrink-0 rounded-md object-cover sm:block" />
          )}
        </li>
      ))}
    </ul>
  );
}

export function SortLinks({ base, sort, extra }: { base: string; sort: ThreadSort; extra?: Record<string, string> }) {
  return (
    <div className="flex items-center gap-1 text-xs" role="group" aria-label="Sortierung">
      <span className="mr-1 text-muted-foreground">Sortieren:</span>
      {(Object.keys(SORT_LABELS) as ThreadSort[]).map((s) => {
        const p = new URLSearchParams(extra);
        if (s !== "aktivitaet") p.set("sort", s);
        const qs = p.toString();
        return (
          <Link
            key={s}
            href={`${base}${qs ? `?${qs}` : ""}`}
            aria-current={sort === s ? "true" : undefined}
            className={cn("rounded-full px-2.5 py-1 font-medium", sort === s ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            {SORT_LABELS[s]}
          </Link>
        );
      })}
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return (
    <nav aria-label="Seiten" className="flex items-center justify-center gap-1 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} aria-label="Vorherige Seite" className="rounded-md p-2 hover:bg-accent">
          <ChevronLeft className="size-4" />
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1]! > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Link
            href={href(n)}
            aria-current={n === page ? "page" : undefined}
            className={cn("min-w-8 rounded-md px-2 py-1 text-center", n === page ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent")}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} aria-label="Nächste Seite" className="rounded-md p-2 hover:bg-accent">
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}
