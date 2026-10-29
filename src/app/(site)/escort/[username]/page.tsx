import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, MapPin } from "lucide-react";
import { Flag } from "@/components/shared/flag";
import { StarRating } from "@/components/shared/star-rating";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ReviewSection } from "@/components/reviews/review-section";
import { ProfileStories } from "@/components/stories/profile-stories";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileTabs, StickyAside, VisitTracker } from "@/components/profile/profile-client";
import { ProfileGallery } from "@/components/profile/profile-gallery";
import { ChipList, FactsList, HoursList, Panel, PriceTable, rulesToHours, type Fact } from "@/components/profile/profile-parts";
import { PreviewNotice } from "@/components/profile/preview-notice";
import { isStaff } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { countryName } from "@/lib/geo/countries";
import { languageName } from "@/lib/geo/languages";
import {
  BREAST_TYPES,
  CLOTHING_SIZES,
  CLOTHING_STYLES,
  EYE_COLORS,
  GENDERS,
  HAIR_COLORS,
  INTIMATE,
  PIERCINGS,
  SERVICE_GROUPS,
  TATTOOS,
  WORKPLACES,
  ageFrom,
  labelOf,
} from "@/lib/profile/fields";
import { loadEscortPage } from "@/lib/profiles/escort-public";
import { findUser } from "@/lib/profiles/public";
import { canViewProfile } from "@/lib/visibility";

async function resolve(username: string) {
  const viewer = await getSessionUser();
  const u = await findUser(decodeURIComponent(username));
  if (!u || u.status === "deleted") return { viewer, u: null, visible: false };
  return { viewer, u, visible: await canViewProfile(viewer, u) };
}

export async function generateMetadata(props: PageProps<"/escort/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  const { u, visible } = await resolve(username);
  if (!u || !visible || u.accountType !== "escort") return { title: "Profil nicht gefunden" };
  const { escort } = await loadEscortPage(u, null);
  const name = escort?.displayName || u.username;
  return {
    title: escort?.city ? `${name} – Escort in ${escort.city}` : name,
    description: escort?.slogan ?? undefined,
    robots: { index: false },
  };
}

export default async function EscortProfilePage(props: PageProps<"/escort/[username]">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const { viewer, u, visible } = await resolve(username);
  if (!u || !visible) notFound();
  if (u.accountType !== "escort") redirect(`/p/${u.username}`);

  const d = await loadEscortPage(u, viewer);
  const e = d.escort;
  const self = viewer?.id === u.id;
  const name = e?.displayName || u.username;
  const age = ageFrom(e?.birthDate);
  const rating = Number(e?.ratingAvg ?? 0);
  const ratingCount = e?.ratingCount ?? 0;
  const services = new Set(e?.services ?? []);
  const groups = SERVICE_GROUPS.map((g) => ({ group: g.group, items: g.items.filter((i) => services.has(i.value)) })).filter((g) => g.items.length);

  const facts: Fact[] = [
    { label: "Alter", value: age ? `${age} Jahre` : null },
    { label: "Geschlecht", value: e?.gender ? labelOf(GENDERS, e.gender) : null },
    { label: "Grösse", value: e?.heightCm ? `${e.heightCm} cm` : null },
    { label: "Gewicht", value: e?.weightKg ? `${e.weightKg} kg` : null },
    {
      label: "Nationalität",
      value: e?.nationality ? (
        <span className="inline-flex items-center gap-1.5">
          <Flag code={e.nationality} className="size-4" /> {countryName(e.nationality)}
        </span>
      ) : null,
    },
    {
      label: "Sprachen",
      value: d.languages.length ? (
        <span className="flex flex-col items-end gap-1">
          {d.languages.map((l) => (
            <span key={l.languageCode} className="inline-flex items-center gap-2">
              {languageName(l.languageCode)} <StarRating value={l.level} size="xs" label={`Niveau ${languageName(l.languageCode)}`} />
            </span>
          ))}
        </span>
      ) : null,
    },
    { label: "Standort", value: e?.city ? `${e.city} · ${e.radiusKm} km Umkreis` : null },
    { label: "Körbchen", value: e?.cupSize ? `${e.cupSize}${e.breastType ? ` · ${labelOf(BREAST_TYPES, e.breastType)}` : ""}` : null },
    { label: "Intimbereich", value: e?.intimate ? labelOf(INTIMATE, e.intimate) : null },
    { label: "Haare", value: e?.hairColor ? labelOf(HAIR_COLORS, e.hairColor) : null },
    { label: "Augen", value: e?.eyeColor ? labelOf(EYE_COLORS, e.eyeColor) : null },
    { label: "Tattoos", value: e?.tattoos ? labelOf(TATTOOS, e.tattoos) : null },
    { label: "Piercings", value: e?.piercings.length ? e.piercings.map((p) => labelOf(PIERCINGS, p)).join(", ") : null },
    { label: "Kleidergrösse", value: e?.clothingSize ? labelOf(CLOTHING_SIZES, e.clothingSize) : null },
    { label: "Schuhgrösse", value: e?.shoeSize ? `EU ${e.shoeSize}` : null },
    { label: "Stil", value: e?.clothingStyles.length ? e.clothingStyles.map((s) => labelOf(CLOTHING_STYLES, s)).join(", ") : null },
  ];

  const about = (
    <Panel>
      {e?.slogan && <p className="mb-3 font-display text-base font-semibold">„{e.slogan}“</p>}
      {e?.about ? <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{e.about}</p> : <p className="text-sm text-muted-foreground">Noch keine Beschreibung.</p>}
    </Panel>
  );
  const servicesTab = (
    <Panel>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Services angegeben.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.group}>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{g.group}</h3>
              <ChipList items={g.items.map((i) => i.label)} />
            </div>
          ))}
        </div>
      )}
      {e?.workplace && <p className="mt-4 text-xs text-muted-foreground">Arbeitsort: {labelOf(WORKPLACES, e.workplace)}</p>}
    </Panel>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {(self || isStaff(viewer)) && <PreviewNotice user={u} self={self} />}
      <VisitTracker targetId={u.id} src={typeof sp.src === "string" ? sp.src : null} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ProfileGallery items={d.gallery} name={name} fallback={d.avatarUrl} />
          <ProfileStories userId={u.id} viewer={viewer} />
          <div id="berichte">
            <ProfileTabs
              tabs={[
                { value: "about", label: "Über mich", content: about },
                { value: "services", label: "Services", count: services.size, content: servicesTab },
                { value: "reviews", label: "Berichte", count: ratingCount, content: <ReviewSection targetId={u.id} targetType="escort" viewer={viewer} /> },
              ]}
            />
          </div>
        </div>

        <StickyAside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <UserAvatar user={{ name, avatarUrl: d.avatarUrl, online: d.online }} size="md" ring={d.hasStory ? "story" : undefined} />
              <div className="min-w-0">
                <h1 className="flex items-center gap-1.5 text-xl leading-tight font-extrabold">
                  <span className="truncate">{name}</span>
                  {age && <span className="text-base font-semibold text-muted-foreground">{age}</span>}
                  {u.kycStatus === "verified" && <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="Verifiziert" />}
                </h1>
                {e?.city && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {e.city} · {e.radiusKm} km
                  </p>
                )}
              </div>
            </div>
            <Link href="#berichte" className="flex items-center gap-2 text-xs">
              <StarRating value={rating} size="sm" />
              <span className="font-semibold">{ratingCount ? rating.toFixed(1) : "–"}</span>
              <span className="text-muted-foreground">
                ({ratingCount} {ratingCount === 1 ? "Bericht" : "Berichte"})
              </span>
            </Link>
            <ProfileActions
              targetId={u.id}
              username={u.username}
              self={self}
              loggedIn={Boolean(viewer)}
              favorite={d.relation.favorite}
              following={d.relation.following}
              message={d.connect}
              bookHref={`/escort/${u.username}/buchen`}
              provider
            />
          </section>
          <Panel title="Steckbrief">
            <FactsList facts={facts} />
          </Panel>
          <Panel title="Preise">
            <PriceTable prices={e?.prices ?? []} currency={e?.currency} />
            {e?.workplace && <p className="mt-2 text-[11px] text-muted-foreground">{labelOf(WORKPLACES, e.workplace)}</p>}
          </Panel>
          <Panel title="Arbeitszeiten">
            <HoursList hours={rulesToHours(d.rules)} emptyText="Termine nach Vereinbarung." />
          </Panel>
        </StickyAside>
      </div>
    </div>
  );
}
