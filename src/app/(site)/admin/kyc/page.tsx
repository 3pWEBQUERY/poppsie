import Link from "next/link";
import type { Metadata } from "next";
import { Camera, IdCard } from "lucide-react";
import { Empty, PageTitle } from "@/components/admin/badges";
import { KycDecision } from "@/components/admin/kyc-decision";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/admin/guard";
import { ACCOUNT_TYPE_LABEL, ageFrom, formatDate, formatDateTime, timeAgo } from "@/lib/admin/labels";
import { kycQueue } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Verifikation (KYC)" };

const CHECK_STATUS = { pending: "Offen", verified: "Bestätigt", rejected: "Abgelehnt" } as Record<string, string>;

export default async function KycPage() {
  await requireStaffPage();
  const queue = await kycQueue();
  return (
    <div>
      <PageTitle
        title="Verifikation (KYC)"
        description="Escorts und Clubs mit offener Prüfung. Ausweisdaten liegen beim KYC-Anbieter; hier werden Alter, Selfie und Code-Geste abgeglichen."
      />
      {queue.length === 0 ? (
        <Empty>Keine offenen Verifikationen.</Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {queue.map((p) => {
            const age = ageFrom(p.birthDate);
            const escort = p.user.accountType === "escort";
            const blocked = escort && (age === null || age < 18);
            return (
              <li key={p.user.id} className="rounded-lg border bg-card">
                <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                  <UserAvatar user={{ name: p.displayName || p.clubName || p.user.username, avatarUrl: p.avatarUrl }} size="sm" />
                  <div className="min-w-0">
                    <Link href={`/admin/benutzer/${p.user.id}`} className="font-semibold hover:underline">
                      {p.displayName || p.clubName || p.user.username}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      @{p.user.username} · {ACCOUNT_TYPE_LABEL[p.user.accountType]} · wartet seit {timeAgo(p.user.updatedAt)}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    {escort ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">Geburtsdatum (Profil)</p>
                        <p className={`font-display text-lg font-bold ${blocked ? "text-primary" : "text-success"}`}>
                          {p.birthDate ? `${formatDate(p.birthDate)} · ${age} Jahre` : "fehlt"}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Betreiber: Alter über den Ausweis prüfen</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
                  <div className="flex flex-col gap-3">
                    {p.checks.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Nachweise eingereicht.</p>}
                    {p.checks.map((c) => (
                      <div key={c.id} className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row">
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            {c.kind === "photo" ? <Camera className="size-4" /> : <IdCard className="size-4" />}
                            {c.kind === "photo" ? "Foto-Verifikation (Selfie mit Geste)" : "Identität & Alter"}
                            <Badge variant={c.status === "pending" ? "warning" : c.status === "verified" ? "success" : "default"}>{CHECK_STATUS[c.status] ?? c.status}</Badge>
                          </p>
                          {c.gestureCode && (
                            <p className="text-sm">
                              Code / Geste: <span className="rounded bg-secondary px-2 py-0.5 font-display text-base font-bold tracking-widest">{c.gestureCode}</span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Anbieter {c.provider}
                            {c.providerRef && !c.media ? ` · Referenz ${c.providerRef}` : ""} · eingereicht {formatDateTime(c.createdAt)}
                          </p>
                          {c.note && <p className="text-xs">Notiz: {c.note}</p>}
                        </div>
                        {c.media &&
                          (c.media.kind === "video" ? (
                            <video src={c.media.url} controls className="h-48 w-full rounded-md bg-black object-contain sm:w-40" />
                          ) : (
                            <a href={c.media.url} target="_blank" rel="noreferrer" className="shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={c.media.url} alt="Selfie zur Verifikation" className="h-48 w-full rounded-md object-cover sm:w-40" />
                            </a>
                          ))}
                      </div>
                    ))}
                  </div>
                  <KycDecision
                    userId={p.user.id}
                    canApprove={!blocked}
                    blockReason={age !== null && age < 18 ? "Unter 18 – Freischaltung gesperrt" : "Geburtsdatum fehlt im Profil"}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
