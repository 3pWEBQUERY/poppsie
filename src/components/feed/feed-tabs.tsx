import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tabs "Für dich" / "Neueste" mit optionalem Hashtag-Filter. */
export function FeedTabs({ tab, tag }: { tab: "fuer-dich" | "neueste"; tag: string | null }) {
  const q = (t: string) => {
    const p = new URLSearchParams();
    if (t === "neueste") p.set("tab", "neueste");
    if (tag) p.set("tag", tag);
    const s = p.toString();
    return `/feed${s ? `?${s}` : ""}`;
  };
  return (
    <div className="flex items-center gap-2 border-b">
      {(
        [
          ["fuer-dich", "Für dich"],
          ["neueste", "Neueste"],
        ] as const
      ).map(([k, label]) => (
        <Link
          key={k}
          href={q(k)}
          aria-current={tab === k ? "page" : undefined}
          className={cn(
            "relative px-3 pb-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
            tab === k && "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary",
          )}
        >
          {label}
        </Link>
      ))}
      {tag && (
        <Link
          href={tab === "neueste" ? "/feed?tab=neueste" : "/feed"}
          className="mb-2 ml-auto inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25"
          aria-label={`Filter #${tag} entfernen`}
        >
          #{tag} <X className="size-3" />
        </Link>
      )}
    </div>
  );
}
