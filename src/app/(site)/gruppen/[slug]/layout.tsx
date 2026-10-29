import { MapPin, Users } from "lucide-react";
import { PRIVACY_ICON } from "@/components/groups/group-card";
import { GroupTabs } from "@/components/groups/group-tabs";
import { JoinButton } from "@/components/groups/join-button";
import { ShareButton } from "@/components/content/share-dialog";
import { ContentViewerProvider } from "@/components/content/viewer-context";
import { contentViewer } from "@/lib/content/viewer";
import { CANTON_NAMES } from "@/lib/geo/countries";
import { loadGroupPage } from "@/lib/groups/page-data";
import { pendingCounts } from "@/lib/groups/queries";
import { PRIVACY_LABELS } from "@/lib/groups/types";

export default async function GroupLayout(props: LayoutProps<"/gruppen/[slug]">) {
  const { slug } = await props.params;
  const { user, group: g, membership, coverUrl, can } = await loadGroupPage(slug);
  const [viewer, counts] = await Promise.all([contentViewer(user), can.moderate ? pendingCounts(g.id) : Promise.resolve(null)]);
  const Icon = PRIVACY_ICON[g.privacy];

  return (
    <ContentViewerProvider viewer={viewer}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <header className="overflow-hidden rounded-lg border bg-card">
          <div className="aspect-[4/1] max-h-56 w-full bg-secondary">
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold">{g.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Icon className="size-3.5" /> {PRIVACY_LABELS[g.privacy]}e Gruppe
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" /> {g.memberCount} Mitglieder
                </span>
                {g.region && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {CANTON_NAMES[g.region as keyof typeof CANTON_NAMES] ?? g.region}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {user && g.privacy !== "secret" && <ShareButton embed={{ type: "group", id: g.id }} label="Teilen" variant="outline" className="h-9 text-foreground" />}
              <JoinButton groupId={g.id} privacy={g.privacy} status={membership?.status ?? null} isOwner={can.owner} loggedIn={Boolean(user)} />
            </div>
          </div>
          <div className="px-4">
            <GroupTabs slug={g.slug} admin={can.moderate} badge={counts ? counts.requests + counts.posts : 0} />
          </div>
        </header>
        {props.children}
      </div>
    </ContentViewerProvider>
  );
}
