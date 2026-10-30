import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { StoriesBar } from "@/components/stories/stories-bar";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { storyBar } from "@/lib/stories/queries";
import { viewerCountries } from "@/lib/visibility";

export const metadata: Metadata = { title: "Stories" };

export default async function StoriesPage() {
  const user = await getSessionUser();
  const entries = await storyBar(user, await viewerCountries(user), 120);
  const provider = user?.accountType === "escort" || user?.accountType === "club";
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">Stories</h1>
          <p className="text-sm text-muted-foreground">Aktuelle Stories der letzten 24 Stunden von Escorts und Clubs.</p>
        </div>
        {provider && (
          <Button asChild>
            <Link href="/dashboard/stories">
              <Plus /> Story erstellen
            </Link>
          </Button>
        )}
      </div>
      {!user && (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Link href="/anmelden?next=/stories" className="font-semibold text-primary hover:underline">
            Melde dich an
          </Link>
          , um Stories anzusehen, zu liken und zu kommentieren.
        </p>
      )}
      {entries.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">Gerade gibt es keine aktiven Stories.</p>
      ) : (
        <div className="rounded-lg border bg-card p-5">
          <StoriesBar entries={entries} viewerId={user?.id ?? null} layout="grid" />
        </div>
      )}
    </div>
  );
}
