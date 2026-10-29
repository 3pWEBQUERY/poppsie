import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ActionPanel } from "@/components/admin/action-panel";
import { FlagStatusBadge, KycBadge, Panel, ReasonBadge, RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { ActionHistory, FlagList } from "@/components/admin/history";
import { TargetPreview } from "@/components/admin/target-preview";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/admin/guard";
import { ACCOUNT_TYPE_LABEL, TARGET_LABEL, URGENT_REASONS, formatDateTime } from "@/lib/admin/labels";
import { loadTargetPreview } from "@/lib/admin/preview";
import { actionsAgainst, flagsAbout, flagsOnTarget, getFlag } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Meldung" };

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function FlagDetailPage(props: PageProps<"/admin/meldungen/[id]">) {
  await requireStaffPage();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const row = await getFlag(id);
  if (!row) notFound();
  const { flag } = row;
  const preview = await loadTargetPreview(flag.targetType, flag.targetId);
  const ownerId = flag.targetUserId ?? preview.ownerId;
  const [owner] = ownerId ? await db.select().from(users).where(eq(users.id, ownerId)) : [];
  const [history, sameTarget, aboutOwner] = await Promise.all([
    owner ? actionsAgainst(owner.id) : Promise.resolve([]),
    flagsOnTarget(flag.targetType, flag.targetId),
    owner ? flagsAbout(owner.id, 20) : Promise.resolve([]),
  ]);
  const urgent = URGENT_REASONS.has(flag.reason);
  const signals = flag.autoSignals ? Object.entries(flag.autoSignals) : [];
  const removable = preview.exists && !preview.removed && flag.targetType !== "profile";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Zur Warteschlange
      </Link>
      <div className={`rounded-lg border bg-card p-4 ${urgent ? "border-primary/60 border-l-4 border-l-primary" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <ReasonBadge reason={flag.reason} />
          <Badge variant="outline">{TARGET_LABEL[flag.targetType]}</Badge>
          <FlagStatusBadge status={flag.status} />
          <span className="text-xs text-muted-foreground">Priorität {flag.priority}</span>
          <span className="ml-auto text-xs text-muted-foreground">Eingegangen {formatDateTime(flag.createdAt)}</span>
        </div>
        {urgent && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            Dringende Kategorie{owner?.profileHidden ? ": Das Profil ist vorläufig ausgeblendet" : ""}. Bei konkreten Hinweisen auf eine akute Gefährdung sofort die Polizei (117) informieren.
          </p>
        )}
        {flag.resolution && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Entscheid{row.resolver ? ` von @${row.resolver}` : ""}{flag.resolvedAt ? ` am ${formatDateTime(flag.resolvedAt)}` : ""}: </span>
            {flag.resolution}
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Gemeldeter Inhalt">
            <TargetPreview preview={preview} />
          </Panel>
          <Panel title="Meldung">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Gemeldet von</dt>
              <dd>
                {row.reporterId ? (
                  <Link href={`/admin/benutzer/${row.reporterId}`} className="underline">
                    @{row.reporter}
                  </Link>
                ) : (
                  "System / gelöschtes Konto"
                )}
              </dd>
              <dt className="text-muted-foreground">Details</dt>
              <dd className="whitespace-pre-wrap">{flag.details || "–"}</dd>
            </dl>
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Automatische Prüfung</p>
              {signals.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {signals.map(([k, v]) => (
                    <li key={k}>
                      <Badge variant="outline">
                        {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Keine Hinweise.</p>
              )}
            </div>
          </Panel>
          <Panel title={`Alle Meldungen zu diesem Inhalt (${sameTarget.length})`}>
            <FlagList rows={sameTarget} currentId={flag.id} />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Aktionen">
            <ActionPanel
              flag={{ id: flag.id, status: flag.status, targetType: flag.targetType, contentRemovable: removable, urgent }}
              user={owner ? { id: owner.id, status: owner.status, profileHidden: owner.profileHidden } : null}
            />
          </Panel>
          {owner && (
            <Panel
              title="Betroffene Person"
              action={
                <Link href={`/admin/benutzer/${owner.id}`} className="text-xs underline">
                  Konto öffnen
                </Link>
              }
            >
              <p className="text-sm font-semibold">@{owner.username}</p>
              <p className="text-xs text-muted-foreground">
                {ACCOUNT_TYPE_LABEL[owner.accountType]} · seit {formatDateTime(owner.createdAt)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <UserStatusBadge status={owner.status} until={owner.suspendedUntil} />
                <KycBadge status={owner.kycStatus} />
                <RoleBadge role={owner.role} />
                {owner.profileHidden && <Badge variant="muted">Profil ausgeblendet</Badge>}
                {owner.deletionRequestedAt && <Badge variant="muted">Löschung beantragt</Badge>}
              </div>
            </Panel>
          )}
          {owner && (
            <Panel title="Bisherige Aktionen gegen die Person">
              <ActionHistory rows={history} />
            </Panel>
          )}
          {owner && (
            <Panel title={`Meldungen zur Person (${aboutOwner.length})`}>
              <FlagList rows={aboutOwner} currentId={flag.id} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
