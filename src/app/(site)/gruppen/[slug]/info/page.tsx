import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Crown, Flag } from "lucide-react";
import { ReportDialog } from "@/components/shared/report-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { loadGroupPage } from "@/lib/groups/page-data";
import { PRIVACY_HINTS } from "@/lib/groups/types";

export const metadata: Metadata = { title: "Über die Gruppe" };

export default async function GroupInfoPage(props: PageProps<"/gruppen/[slug]/info">) {
  const { slug } = await props.params;
  const { user, group: g, owner } = await loadGroupPage(slug);
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold">Beschreibung</h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{g.description || "Keine Beschreibung."}</p>
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold">Regeln</h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{g.rules || "Es gelten die allgemeinen Community-Regeln von Poppsie."}</p>
        </section>
      </div>
      <aside className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
        <p className="text-xs text-muted-foreground">{PRIVACY_HINTS[g.privacy]}</p>
        {owner && (
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-primary" />
            <UserAvatar user={owner} link size="xs" />
            <Link href={owner.href} className="font-medium hover:underline">
              {owner.name}
            </Link>
          </div>
        )}
        <p className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-4" /> Gegründet am {g.createdAt.toLocaleDateString("de-CH")}
        </p>
        {g.requirePostApproval && <p className="text-xs text-muted-foreground">Beiträge werden vor der Veröffentlichung von den Moderatoren geprüft.</p>}
        {user && (
          <ReportDialog
            targetType="group"
            targetId={g.id}
            targetUserId={g.ownerId}
            trigger={
              <Button variant="ghost" size="sm" className="w-fit text-muted-foreground">
                <Flag /> Gruppe melden
              </Button>
            }
          />
        )}
      </aside>
    </div>
  );
}
