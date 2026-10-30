import Link from "next/link";
import type { Metadata } from "next";
import { Hash, Users } from "lucide-react";
import { ContentViewerProvider } from "@/components/content/viewer-context";
import { FeedList } from "@/components/feed/feed-list";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { StoriesBar } from "@/components/stories/stories-bar";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { cleanTag, feedPage, trendingTags } from "@/lib/content/feed";
import { contentViewer } from "@/lib/content/viewer";
import { regionSuggestions } from "@/lib/groups/queries";
import { storyBar } from "@/lib/stories/queries";
import { viewerCountries } from "@/lib/visibility";

export const metadata: Metadata = { title: "Newsfeed" };

export default async function FeedPage(props: PageProps<"/feed">) {
  const sp = await props.searchParams;
  const user = await getSessionUser();
  const tab = sp.tab === "neueste" ? "neueste" : "fuer-dich";
  const tag = cleanTag(typeof sp.tag === "string" ? sp.tag : null);
  const countries = await viewerCountries(user);
  const [page, bar, viewer, tags, groups] = await Promise.all([
    feedPage(user, countries, { kind: "feed", tab, tag }),
    storyBar(user, countries),
    contentViewer(user),
    trendingTags(),
    user ? regionSuggestions(user, 4) : Promise.resolve([]),
  ]);
  const provider = user?.accountType === "escort" || user?.accountType === "club";

  return (
    <ContentViewerProvider viewer={viewer}>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,640px)_1fr] lg:justify-center">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="sr-only">Newsfeed</h1>
          {(bar.length > 0 || provider) && (
            <section className="rounded-lg border bg-card p-3" aria-label="Stories">
              <StoriesBar entries={bar} viewerId={user?.id ?? null} canCreate={provider && user?.profileComplete} />
            </section>
          )}
          <FeedTabs tab={tab} tag={tag} />
          {!user && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">Melde dich an, um Beiträge zu schreiben, zu reagieren und mehr zu sehen.</span>
              <Button asChild size="sm">
                <Link href="/anmelden?next=/feed">Anmelden</Link>
              </Button>
            </div>
          )}
          <FeedList
            key={`${tab}:${tag ?? ""}`}
            scope={{ kind: "feed", tab, tag }}
            initial={page}
            composer={{ canPost: Boolean(user?.profileComplete), hint: user && !user.profileComplete ? "Stelle dein Profil fertig, um Beiträge zu schreiben." : undefined, showVisibility: true, placeholder: tag ? `Etwas zu #${tag} schreiben …` : "Was gibt's Neues?" }}
            emptyText={tag ? `Noch keine Beiträge mit #${tag}.` : "Noch keine Beiträge. Folge Profilen oder schreib den ersten Beitrag!"}
          />
        </div>
        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="sticky top-28 flex flex-col gap-4">
            {tags.length > 0 && (
              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
                  <Hash className="size-4 text-primary" /> Beliebte Hashtags
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <li key={t.tag}>
                      <Link href={`/feed?tag=${encodeURIComponent(t.tag)}`} className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-accent">
                        #{t.tag} <span className="ml-1 text-muted-foreground">{t.n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {groups.length > 0 && (
              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
                  <Users className="size-4 text-primary" /> Gruppen in deiner Region
                </h2>
                <ul className="flex flex-col gap-2">
                  {groups.map((g) => (
                    <li key={g.id}>
                      <Link href={`/gruppen/${g.slug}`} className="flex flex-col rounded-md px-2 py-1.5 hover:bg-accent">
                        <span className="truncate text-sm font-medium">{g.name}</span>
                        <span className="text-xs text-muted-foreground">{g.memberCount} Mitglieder</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-lg border bg-card p-4 text-sm">
              <h2 className="mb-2 text-sm font-bold">Community</h2>
              <div className="flex flex-col gap-1">
                <Link href="/forum" className="rounded-md px-2 py-1.5 hover:bg-accent">
                  Forum
                </Link>
                <Link href="/gruppen" className="rounded-md px-2 py-1.5 hover:bg-accent">
                  Gruppen
                </Link>
                <Link href="/stories" className="rounded-md px-2 py-1.5 hover:bg-accent">
                  Alle Stories
                </Link>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </ContentViewerProvider>
  );
}
