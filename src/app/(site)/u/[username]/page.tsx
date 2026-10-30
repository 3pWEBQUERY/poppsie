import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Award, CalendarDays, MapPin, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/shared/flag";
import { UserAvatar } from "@/components/shared/user-avatar";
import { MemberReviewSection } from "@/components/reviews/member-review-section";
import { PreviewNotice } from "@/components/profile/preview-notice";
import { ProfileActions } from "@/components/profile/profile-actions";
import { VisitTracker } from "@/components/profile/profile-client";
import { Panel } from "@/components/profile/profile-parts";
import { isStaff } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { CANTON_NAMES, countryName } from "@/lib/geo/countries";
import { badgeLabels } from "@/lib/profiles/badges";
import { findUser, relationTo, reviewsWritten, singleMedia } from "@/lib/profiles/public";
import { canViewProfile } from "@/lib/visibility";

async function resolve(username: string) {
  const viewer = await getSessionUser();
  const u = await findUser(decodeURIComponent(username));
  if (!u || u.status === "deleted") return { viewer, u: null, visible: false };
  return { viewer, u, visible: await canViewProfile(viewer, u) };
}

export async function generateMetadata(props: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  const { u, visible } = await resolve(username);
  if (!u || !visible) return { title: "Profil nicht gefunden" };
  return { title: `${u.username} – Mitglied`, robots: { index: false } };
}

/** Öffentliches Mitgliederprofil. Präferenzen werden nie angezeigt. */
export default async function MemberProfilePage(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const { viewer, u, visible } = await resolve(username);
  if (!u || !visible) notFound();
  if (u.accountType !== "member") redirect(`/p/${u.username}`);

  const self = viewer?.id === u.id;
  const [avatarUrl, coverUrl, rel, written, badges] = await Promise.all([
    singleMedia(u.avatarMediaId, viewer, "t"),
    singleMedia(u.coverMediaId, viewer, "o"),
    relationTo(viewer, u.id),
    reviewsWritten(u.id),
    badgeLabels(u),
  ]);
  const region = u.country === "CH" && u.region ? (CANTON_NAMES[u.region as keyof typeof CANTON_NAMES] ?? u.region) : u.region;
  const since = new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric" }).format(u.createdAt);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {(self || isStaff(viewer)) && <PreviewNotice user={u} self={self} />}
      <VisitTracker targetId={u.id} src={typeof sp.src === "string" ? sp.src : null} />
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="relative h-32 bg-band sm:h-48">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="size-full object-cover" draggable={false} />
          )}
        </div>
        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
          <span className="-mt-12 inline-flex w-fit shrink-0 rounded-full border-4 border-card sm:-mt-16">
            <UserAvatar user={{ name: u.username, avatarUrl }} size="xl" className="[&>span]:size-24 sm:[&>span]:size-32" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold">{u.username}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {u.country && (
                <span className="inline-flex items-center gap-1.5">
                  <Flag code={u.country} className="size-3.5" />
                  {[region, countryName(u.country)].filter(Boolean).join(", ")}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Mitglied seit {since}
              </span>
              <span className="inline-flex items-center gap-1">
                <PenLine className="size-3.5" /> {written} {written === 1 ? "Bericht" : "Berichte"} geschrieben
              </span>
            </div>
            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Badge key={b} variant="outline" className="gap-1">
                    <Award className="text-primary" /> {b}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="w-full sm:w-72">
            <ProfileActions
              targetId={u.id}
              username={u.username}
              self={self}
              loggedIn={Boolean(viewer)}
              favorite={rel.favorite}
              following={rel.following}
              message={{ allowed: true, reason: null }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-6">
          <Panel title="Über mich">
            {u.bio ? <p className="text-sm leading-relaxed whitespace-pre-line">{u.bio}</p> : <p className="text-sm text-muted-foreground">{self ? "Du hast noch nichts über dich geschrieben." : "Keine Angaben."}</p>}
          </Panel>
          <MemberReviewSection memberId={u.id} viewer={viewer} />
        </div>
        <Panel title="Steckbrief" className="h-fit">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-muted-foreground">Region</dt>
            <dd className="text-right font-medium">{region || "–"}</dd>
            <dt className="text-muted-foreground">Mitglied seit</dt>
            <dd className="text-right font-medium">{since}</dd>
            <dt className="text-muted-foreground">Berichte</dt>
            <dd className="text-right font-medium">{written}</dd>
          </dl>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="mt-0.5 size-3 shrink-0" /> Vorlieben und Präferenzen sind privat und werden nie angezeigt.
          </p>
        </Panel>
      </div>
    </div>
  );
}
