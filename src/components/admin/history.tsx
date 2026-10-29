import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ACTION_LABEL, APPEAL_STATUS_LABEL, REASON_LABEL, STATUS_LABEL, TARGET_LABEL, formatDateTime, type FlagReason, type FlagStatus, type FlagTarget, type ModerationActionType } from "@/lib/admin/labels";
import { Empty } from "./badges";

type ActionRow = {
  action: { id: string; action: ModerationActionType; reason: string; until: Date | null; createdAt: Date; flagId: string | null };
  moderator: string | null;
  appealStatus: "open" | "accepted" | "rejected" | null;
};

export function ActionHistory({ rows }: { rows: ActionRow[] }) {
  if (!rows.length) return <Empty>Bisher keine Moderationsaktionen.</Empty>;
  return (
    <ol className="flex flex-col divide-y">
      {rows.map(({ action: a, moderator, appealStatus }) => (
        <li key={a.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant={a.action.startsWith("suspend") ? "default" : "secondary"}>{ACTION_LABEL[a.action]}</Badge>
            {a.until && <span className="text-muted-foreground">bis {formatDateTime(a.until)}</span>}
            {appealStatus && <Badge variant="outline">Einspruch: {APPEAL_STATUS_LABEL[appealStatus]}</Badge>}
            <span className="ml-auto text-muted-foreground">
              {formatDateTime(a.createdAt)} · @{moderator ?? "?"}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{a.reason}</p>
          {a.flagId && (
            <Link href={`/admin/meldungen/${a.flagId}`} className="text-[11px] text-muted-foreground underline">
              Zugehörige Meldung
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}

type FlagRow = {
  flag: { id: string; reason: FlagReason; status: FlagStatus; targetType: FlagTarget; createdAt: Date; details: string | null };
  reporter: string | null;
};

export function FlagList({ rows, currentId }: { rows: FlagRow[]; currentId?: string }) {
  if (!rows.length) return <Empty>Keine Meldungen.</Empty>;
  return (
    <ul className="flex flex-col divide-y">
      {rows.map(({ flag: f, reporter }) => (
        <li key={f.id} className="py-2 first:pt-0 last:pb-0">
          <Link href={`/admin/meldungen/${f.id}`} className={`flex flex-col gap-0.5 text-xs hover:text-foreground ${f.id === currentId ? "font-semibold" : ""}`}>
            <span className="flex flex-wrap items-center gap-1.5">
              <span>{REASON_LABEL[f.reason]}</span>
              <span className="text-muted-foreground">· {TARGET_LABEL[f.targetType]}</span>
              <Badge variant="muted" className="ml-auto">
                {STATUS_LABEL[f.status]}
              </Badge>
            </span>
            <span className="text-muted-foreground">
              {formatDateTime(f.createdAt)} · von @{reporter ?? "System"}
              {f.details ? ` · «${f.details.slice(0, 80)}»` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
