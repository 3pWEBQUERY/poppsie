import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Lock } from "lucide-react";
import { GroupForm } from "@/components/groups/group-form";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Gruppe erstellen" };

export default async function NewGroupPage() {
  const user = await requirePageUser({ next: "/gruppen/neu" });
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <Link href="/gruppen" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zu den Gruppen
      </Link>
      <h1 className="text-2xl font-extrabold">Gruppe erstellen</h1>
      {user.profileComplete ? (
        <GroupForm />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Bitte stelle zuerst dein Profil fertig, um Gruppen zu erstellen.</p>
          <Button asChild>
            <Link href="/dashboard/profil">Profil fertigstellen</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
