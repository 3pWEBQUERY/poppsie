import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { Empty, FlagStatusBadge, PageTitle, ReasonBadge } from "@/components/admin/badges";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/admin/guard";
import { FLAG_REASONS, FLAG_TARGETS, REASON_LABEL, TARGET_LABEL, URGENT_REASONS, formatDateTime, timeAgo } from "@/lib/admin/labels";
import { PAGE_SIZE, listFlags, parseQueueFilter } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meldungen" };

const STATUS_OPTIONS = [
  { value: "active", label: "Offen & in Prüfung" },
  { value: "open", label: "Offen" },
  { value: "in_review", label: "In Prüfung" },
  { value: "resolved", label: "Erledigt" },
  { value: "dismissed", label: "Verworfen" },
  { value: "all", label: "Alle" },
];

export default async function ModerationQueuePage(props: PageProps<"/admin">) {
  await requireStaffPage();
  const sp = await props.searchParams;
  const filter = parseQueueFilter(sp);
  const { rows, total } = await listFlags(filter);

  return (
    <div>
      <PageTitle title="Meldungen" description="Sortiert nach Priorität, dann nach Alter. Dringende Kategorien stehen immer oben." />
      <div className="mb-4 rounded-lg border bg-card p-3">
        <FilterBar
          filters={[
            { kind: "select", name: "status", label: "Status", options: STATUS_OPTIONS, value: filter.status === "active" ? "" : filter.status, placeholder: "Offen & in Prüfung" },
            {
              kind: "select",
              name: "grund",
              label: "Grund",
              options: FLAG_REASONS.map((r) => ({ value: r, label: REASON_LABEL[r], group: URGENT_REASONS.has(r) ? "Dringend" : "Weitere" })),
              value: filter.reason,
            },
            { kind: "select", name: "typ", label: "Inhaltstyp", options: FLAG_TARGETS.map((t) => ({ value: t, label: TARGET_LABEL[t] })), value: filter.target },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <Empty>Keine Meldungen für diese Auswahl. Gute Arbeit!</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ flag, reporter, target, targetHidden }) => {
            const urgent = URGENT_REASONS.has(flag.reason);
            return (
              <li key={flag.id}>
                <Link
                  href={`/admin/meldungen/${flag.id}`}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/40 sm:flex-row sm:items-center",
                    urgent && "border-primary/60 border-l-4 border-l-primary bg-primary/5",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ReasonBadge reason={flag.reason} />
                      <Badge variant="outline">{TARGET_LABEL[flag.targetType]}</Badge>
                      <FlagStatusBadge status={flag.status} />
                      {urgent && targetHidden && <Badge variant="muted">Profil vorläufig ausgeblendet</Badge>}
                      <span className="text-[11px] text-muted-foreground">Priorität {flag.priority}</span>
                    </div>
                    <p className="truncate text-sm">
                      {target ? <span className="font-semibold">@{target}</span> : <span className="text-muted-foreground">Urheber wird beim Öffnen ermittelt</span>}
                      {flag.details && <span className="text-muted-foreground"> · «{flag.details}»</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span title={formatDateTime(flag.createdAt)}>{timeAgo(flag.createdAt)}</span>
                    <span>von {reporter ? `@${reporter}` : "System"}</span>
                    <ChevronRight className="size-4" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={filter.page} total={total} pageSize={PAGE_SIZE} basePath="/admin" params={sp} />
    </div>
  );
}
