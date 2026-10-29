import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionPanel } from "@/components/admin/action-panel";
import { KycBadge, Panel, RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { ActionHistory, FlagList } from "@/components/admin/history";
import { RoleSelect } from "@/components/admin/role-select";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/admin/guard";
import { ACCOUNT_TYPE_LABEL, ROLE_LABEL, ageFrom, formatDate, formatDateTime, timeAgo } from "@/lib/admin/labels";
import { actionsAgainst, flagsAbout, flagsBy, userDetail } from "@/lib/admin/queries";
import { profileHref } from "@/lib/users/summary";

export const metadata: Metadata = { title: "Benutzer" };

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function UserDetailPage(props: PageProps<"/admin/benutzer/[id]">) {
  const staff = await requireStaffPage();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const d = await userDetail(id);
  if (!d) notFound();
  const u = d.user;
  const [history, about, by] = await Promise.all([actionsAgainst(u.id), flagsAbout(u.id), flagsBy(u.id)]);
  const age = ageFrom(d.birthDate);
  const rows: [string, React.ReactNode][] = [
    ["E-Mail", u.email],
    ["Kontotyp", ACCOUNT_TYPE_LABEL[u.accountType]],
    ["Anzeigename", d.displayName || d.clubName || "–"],
    ...(u.accountType === "escort" ? ([["Geburtsdatum", d.birthDate ? `${formatDate(d.birthDate)} (${age} Jahre)` : "–"]] as [string, React.ReactNode][]) : []),
    ["Profil vollständig", u.profileComplete ? `Ja (${u.profileScore} %)` : `Nein (${u.profileScore} %)`],
    ["Sprache / Zeitzone", `${u.locale} · ${u.timezone}`],
    ["2FA (TOTP)", u.totpSecret ? "aktiv" : "aus"],
    ["Aktive Sitzungen", String(d.sessionCount)],
    ["Registriert", formatDateTime(u.createdAt)],
    ["Zuletzt aktiv", u.lastSeenAt ? `${formatDateTime(u.lastSeenAt)} (${timeAgo(u.lastSeenAt)})` : "–"],
    ["Löschung beantragt", u.deletionRequestedAt ? formatDateTime(u.deletionRequestedAt) : "–"],
  ];
  const href = profileHref({ username: u.username, accountType: u.accountType, clubSlug: d.clubSlug });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/benutzer" className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Alle Benutzer
      </Link>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
        <h1 className="mr-2 text-xl font-extrabold">@{u.username}</h1>
        <UserStatusBadge status={u.status} until={u.suspendedUntil} />
        {u.accountType !== "member" && <KycBadge status={u.kycStatus} />}
        <RoleBadge role={u.role} />
        {u.profileHidden && <Badge variant="muted">Profil ausgeblendet</Badge>}
        <Link href={href} target="_blank" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Öffentliches Profil <ExternalLink className="size-3" />
        </Link>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Konto">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={`Meldungen zur Person (${about.length})`}>
            <FlagList rows={about} />
          </Panel>
          <Panel title="Moderationsaktionen">
            <ActionHistory rows={history} />
          </Panel>
          {d.kyc.length > 0 && (
            <Panel title="Verifikationen">
              <ul className="flex flex-col divide-y text-sm">
                {d.kyc.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
                    <span className="font-semibold">{k.kind === "photo" ? "Foto" : "Identität"}</span>
                    <Badge variant="secondary">{k.status}</Badge>
                    {k.gestureCode && <span className="text-xs">Code {k.gestureCode}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(k.createdAt)}
                      {k.decidedAt ? ` · entschieden ${formatDateTime(k.decidedAt)}` : ""}
                    </span>
                    {k.note && <p className="w-full text-xs text-muted-foreground">{k.note}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Aktionen">
            {u.id === staff.id ? (
              <p className="text-sm text-muted-foreground">Das ist dein eigenes Konto.</p>
            ) : (
              <ActionPanel user={{ id: u.id, status: u.status, profileHidden: u.profileHidden }} />
            )}
          </Panel>
          <Panel title="Rolle">
            {staff.role === "admin" ? (
              <div className="flex flex-col gap-2">
                <RoleSelect userId={u.id} role={u.role} />
                <p className="text-[11px] text-muted-foreground">Nur Admins können Rollen ändern. Jede Änderung wird im Audit-Log festgehalten.</p>
              </div>
            ) : (
              <p className="text-sm">{ROLE_LABEL[u.role]}</p>
            )}
          </Panel>
          <Panel title={`Eigene Meldungen (${by.length})`}>
            {by.length === 0 ? (
              <p className="text-xs text-muted-foreground">Hat bisher nichts gemeldet.</p>
            ) : (
              <FlagList rows={by.map((f) => ({ flag: f, reporter: u.username }))} />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
