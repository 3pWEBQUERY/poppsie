import Link from "next/link";
import type { Metadata } from "next";
import { Empty, PageTitle } from "@/components/admin/badges";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pagination } from "@/components/admin/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/admin/guard";
import { formatDateTime } from "@/lib/admin/labels";
import { PAGE_SIZE, auditActionPrefixes, listAudit, parseAuditFilter } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Audit-Log" };

const PREFIX_LABEL: Record<string, string> = {
  moderation: "Moderation",
  appeal: "Einsprüche",
  kyc: "Verifikation",
  user: "Benutzer & Rollen",
  account: "Konto (Self-Service)",
  config: "Konfiguration",
  forum: "Forum",
};

function metaSummary(meta: Record<string, unknown> | null) {
  if (!meta) return null;
  const text = JSON.stringify(meta);
  return text.length > 2 ? text : null;
}

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireStaffPage();
  const sp = await props.searchParams;
  const filter = parseAuditFilter(sp);
  const [{ rows, total }, prefixes] = await Promise.all([listAudit(filter), auditActionPrefixes()]);
  return (
    <div>
      <PageTitle title="Audit-Log" description="Alle Admin- und Moderationsaktionen sowie sicherheitsrelevante Kontoänderungen." />
      <div className="mb-4 rounded-lg border bg-card p-3">
        <FilterBar
          filters={[
            { kind: "select", name: "aktion", label: "Bereich", value: filter.action, options: prefixes.map((p) => ({ value: p, label: PREFIX_LABEL[p] ?? p })) },
            { kind: "text", name: "akteur", label: "Akteur (Benutzername)", value: filter.actor, placeholder: "z. B. admin" },
            { kind: "text", name: "ziel", label: "Ziel (Benutzername oder ID)", value: filter.target },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <Empty>Keine Einträge.</Empty>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeit</TableHead>
                <TableHead>Akteur</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Ziel</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ log, actor, target }) => {
                const meta = metaSummary(log.meta);
                return (
                  <TableRow key={log.id} className="align-top">
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell className="text-xs">
                      {log.actorId ? (
                        <Link href={`/admin/benutzer/${log.actorId}`} className="hover:underline">
                          @{actor ?? log.actorId.slice(0, 8)}
                        </Link>
                      ) : (
                        "System"
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{log.action}</code>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.targetType === "user" && log.targetId ? (
                        <Link href={`/admin/benutzer/${log.targetId}`} className="hover:underline">
                          @{target ?? log.targetId.slice(0, 8)}
                        </Link>
                      ) : log.targetType === "flag" && log.targetId ? (
                        <Link href={`/admin/meldungen/${log.targetId}`} className="hover:underline">
                          Meldung {log.targetId.slice(0, 8)}
                        </Link>
                      ) : log.targetType ? (
                        `${log.targetType} ${log.targetId?.slice(0, 12) ?? ""}`
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      {meta ? (
                        meta.length > 120 ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground">{meta.slice(0, 100)} …</summary>
                            <pre className="mt-1 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] whitespace-pre-wrap">{JSON.stringify(log.meta, null, 2)}</pre>
                          </details>
                        ) : (
                          <span className="text-xs break-all text-muted-foreground">{meta}</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{log.ip ?? "–"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={filter.page} total={total} pageSize={PAGE_SIZE} basePath="/admin/audit" params={sp} />
    </div>
  );
}
