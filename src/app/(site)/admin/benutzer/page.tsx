import Link from "next/link";
import type { Metadata } from "next";
import { Empty, KycBadge, PageTitle, RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/admin/guard";
import { ACCOUNT_TYPE_LABEL, formatDate, timeAgo } from "@/lib/admin/labels";
import { PAGE_SIZE, searchUsers } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Benutzer" };

export default async function UsersPage(props: PageProps<"/admin/benutzer">) {
  await requireStaffPage();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const page = Math.max(1, Number(sp.seite) || 1);
  const { rows, total } = await searchUsers(q, page);
  return (
    <div>
      <PageTitle title="Benutzer" description={q ? `${total} Treffer für «${q}»` : "Neueste Konten zuerst. Suche nach Benutzername oder E-Mail."} />
      <div className="mb-4 rounded-lg border bg-card p-3">
        <FilterBar filters={[{ kind: "text", name: "q", label: "Benutzername oder E-Mail", value: q, placeholder: "z. B. sophia oder @gmail.com" }]} />
      </div>
      {rows.length === 0 ? (
        <Empty>Keine Benutzer gefunden.</Empty>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benutzer</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Registriert</TableHead>
                <TableHead>Zuletzt aktiv</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/admin/benutzer/${u.id}`} className="flex flex-col hover:underline">
                      <span className="flex items-center gap-1.5 font-semibold">
                        @{u.username} <RoleBadge role={u.role} />
                      </span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{ACCOUNT_TYPE_LABEL[u.accountType]}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <UserStatusBadge status={u.status} />
                      {u.profileHidden && <Badge variant="muted">ausgeblendet</Badge>}
                      {u.deletionRequestedAt && <Badge variant="muted">Löschung</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>{u.accountType !== "member" ? <KycBadge status={u.kycStatus} /> : <span className="text-xs text-muted-foreground">–</span>}</TableCell>
                  <TableCell className="text-xs">{formatDate(u.createdAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.lastSeenAt ? timeAgo(u.lastSeenAt) : "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/benutzer" params={sp} />
    </div>
  );
}
