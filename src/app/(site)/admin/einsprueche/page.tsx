import Link from "next/link";
import type { Metadata } from "next";
import { AppealDecision } from "@/components/admin/appeal-decision";
import { Empty, PageTitle, UserStatusBadge } from "@/components/admin/badges";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/admin/guard";
import { ACTION_LABEL, APPEAL_STATUS_LABEL, formatDateTime, timeAgo, type ModerationActionType } from "@/lib/admin/labels";
import { listAppeals } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Einsprüche" };

const TABS = [
  { value: "open", label: "Offen" },
  { value: "accepted", label: "Angenommen" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "all", label: "Alle" },
] as const;

const REVERT_HINT: Partial<Record<ModerationActionType, string>> = {
  suspend_temp: "Sperre aufheben",
  suspend_perm: "Sperre aufheben",
  hide_profile: "Profil einblenden",
  remove_content: "Inhalt wiederherstellen, sofern nicht endgültig gelöscht",
  kyc_reject: "Verifikation erneut prüfen",
  warn: "Verwarnung zurücknehmen",
};

export default async function AppealsPage(props: PageProps<"/admin/einsprueche">) {
  await requireStaffPage();
  const sp = await props.searchParams;
  const status = TABS.find((t) => t.value === sp.status)?.value ?? "open";
  const rows = await listAppeals(status);
  return (
    <div>
      <PageTitle title="Einsprüche" description="Einsprüche gegen Moderationsentscheide. Älteste offene zuerst." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "open" ? "/admin/einsprueche" : `/admin/einsprueche?status=${t.value}`}
            className={cn("rounded-full border px-4 py-1.5 text-sm", status === t.value ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>Keine Einsprüche in dieser Ansicht.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ appeal, action, user, userStatus, moderator }) => (
            <li key={appeal.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/benutzer/${appeal.userId}`} className="font-semibold hover:underline">
                  @{user}
                </Link>
                <UserStatusBadge status={userStatus} />
                <Badge variant="secondary">{ACTION_LABEL[action.action]}</Badge>
                <Badge variant={appeal.status === "open" ? "warning" : appeal.status === "accepted" ? "success" : "muted"}>{APPEAL_STATUS_LABEL[appeal.status]}</Badge>
                <span className="ml-auto text-xs text-muted-foreground" title={formatDateTime(appeal.createdAt)}>
                  Eingereicht {timeAgo(appeal.createdAt)}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Ursprünglicher Entscheid · @{moderator ?? "?"} · {formatDateTime(action.createdAt)}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{action.reason}</p>
                  {action.flagId && (
                    <Link href={`/admin/meldungen/${action.flagId}`} className="mt-1 inline-block text-[11px] text-muted-foreground underline">
                      Meldung ansehen
                    </Link>
                  )}
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">Einspruch</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{appeal.body}</p>
                </div>
              </div>
              {appeal.status === "open" && (
                <div className="mt-3">
                  <AppealDecision appealId={appeal.id} revertHint={REVERT_HINT[action.action] ?? "nicht umkehrbar"} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
