import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/shared/star-rating";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ReviewSection } from "@/components/reviews/review-section";
import { ProfileStories } from "@/components/stories/profile-stories";
import { ClubDetails, ClubPrices, Lineup } from "@/components/profile/club-sections";
import { ClubMap } from "@/components/profile/club-map";
import { PreviewNotice } from "@/components/profile/preview-notice";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileTabs, StickyAside, VisitTracker } from "@/components/profile/profile-client";
import { GalleryGrid } from "@/components/profile/profile-gallery";
import { HoursList, OpenBadge, Panel } from "@/components/profile/profile-parts";
import { isStaff } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { findClubBySlug, loadClubPage } from "@/lib/profiles/club-public";
import { canViewProfile } from "@/lib/visibility";

async function resolve(slug: string) {
  const viewer = await getSessionUser();
  const row = await findClubBySlug(decodeURIComponent(slug));
  if (!row || row.user.status === "deleted") return { viewer, row: null, visible: false };
  return { viewer, row, visible: await canViewProfile(viewer, row.user) };
}

export async function generateMetadata(props: PageProps<"/club/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { row, visible } = await resolve(slug);
  if (!row || !visible) return { title: "Profil nicht gefunden" };
  const name = row.club.name || row.user.username;
  return { title: row.club.city ? `${name} – ${row.club.city}` : name, description: row.club.description?.slice(0, 160) ?? undefined, robots: { index: false } };
}

export default async function ClubProfilePage(props: PageProps<"/club/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { viewer, row, visible } = await resolve(slug);
  if (!row || !visible) notFound();
  const { club, user: u } = row;
  const d = await loadClubPage(club, u, viewer);
  const self = viewer?.id === u.id;
  const name = club.name || u.username;
  const rating = Number(club.ratingAvg);
  const address = [club.street, [club.postalCode, club.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent(address || club.city || "");

  const aboutTab = (
    <div className="flex flex-col gap-4">
      <Panel>
        {club.description ? <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{club.description}</p> : <p className="text-sm text-muted-foreground">Noch keine Beschreibung.</p>}
      </Panel>
      <Panel title="Angebot & Ausstattung">
        <ClubDetails fields={d.fields} data={club.data} />
      </Panel>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {(self || isStaff(viewer)) && <PreviewNotice user={u} self={self} />}
      <VisitTracker targetId={u.id} src={typeof sp.src === "string" ? sp.src : null} />

      <div className="relative h-40 overflow-hidden rounded-lg border bg-card sm:h-64">
        {d.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.coverUrl} alt="" className="size-full object-cover" draggable={false} />
        )}
      </div>
      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-end sm:px-4">
        <div className="-mt-12 shrink-0 sm:-mt-14">
          <span className="inline-flex rounded-full border-4 border-background">
            <UserAvatar user={{ name, avatarUrl: d.logoUrl }} size="lg" ring={d.hasStory ? "story" : undefined} className="[&>span]:size-24" />
          </span>
        </div>
        <div className="min-w-0 flex-1 sm:pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl leading-tight font-extrabold">{name}</h1>
            {u.kycStatus === "verified" && <BadgeCheck className="size-5 text-primary" aria-label="Verifiziert" />}
            <Badge variant="secondary">{d.typeLabel}</Badge>
            <OpenBadge hours={club.openingHours} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {club.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {club.city}
              </span>
            )}
            <Link href="#berichte" className="flex items-center gap-1.5">
              <StarRating value={rating} size="xs" />
              <span className="font-semibold text-foreground">{club.ratingCount ? rating.toFixed(1) : "–"}</span>({club.ratingCount} {club.ratingCount === 1 ? "Bericht" : "Berichte"})
            </Link>
          </div>
        </div>
        <div className="w-full sm:w-80 sm:pb-1">
          <ProfileActions
            targetId={u.id}
            username={u.username}
            self={self}
            loggedIn={Boolean(viewer)}
            favorite={d.relation.favorite}
            following={d.relation.following}
            message={{ allowed: true, reason: null }}
            provider
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ProfileStories userId={u.id} viewer={viewer} />
          <div id="berichte">
            <ProfileTabs
              tabs={[
                { value: "about", label: "Über uns", content: aboutTab },
                { value: "lineup", label: "Line-up", count: d.lineup.length, content: <Lineup entries={d.lineup} /> },
                { value: "gallery", label: "Galerie", count: d.gallery.length, content: <GalleryGrid items={d.gallery} name={name} /> },
                { value: "reviews", label: "Berichte", count: club.ratingCount, content: <ReviewSection targetId={u.id} targetType="club" viewer={viewer} /> },
              ]}
            />
          </div>
        </div>
        <StickyAside className="flex flex-col gap-4">
          <Panel title="Öffnungszeiten" action={<OpenBadge hours={club.openingHours} />}>
            <HoursList hours={club.openingHours} />
          </Panel>
          <Panel title="Preise & Eintritt">
            <ClubPrices fields={d.fields} data={club.data} />
          </Panel>
          <Panel title="Adresse">
            {address && <p className="mb-3 text-[13px]">{address}</p>}
            {club.lat != null && club.lng != null ? (
              <>
                <ClubMap lat={club.lat} lng={club.lng} label={name} />
                <a
                  href={`https://www.openstreetmap.org/search?query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3" /> In OpenStreetMap öffnen
                </a>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Keine Adresse hinterlegt.</p>
            )}
          </Panel>
        </StickyAside>
      </div>
    </div>
  );
}
