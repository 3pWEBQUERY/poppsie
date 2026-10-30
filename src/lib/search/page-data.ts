import "server-only";
import { after } from "next/server";
import { db } from "@/db";
import { analyticsEvents, clubTypeSchemas } from "@/db/schema";
import type { ProfileCardData } from "@/components/shared/profile-card";
import type { ClubFilterField } from "@/components/search/club-filters";
import type { SessionUser } from "@/lib/auth/session";
import { sha256 } from "@/lib/auth/crypto";
import { clientIp, isBot, requestCountry } from "@/lib/request";
import { usersWithActiveStory } from "@/lib/stories/active";
import { viewerCountries } from "@/lib/visibility";
import { clubCard, escortCard, mapPoints, withFavorites, type MapPoint } from "./cards";
import { searchClubs } from "./clubs";
import { searchEscorts } from "./escorts";
import { MAP_LIMIT, originOf, PAGE_SIZE, type SearchFilters } from "./filters";
import type { ViewerContext } from "./sql";

export async function viewerContext(viewer: SessionUser | null, origin: ViewerContext["origin"]): Promise<ViewerContext> {
  return { viewerId: viewer?.id ?? null, countries: await viewerCountries(viewer), origin };
}

/** Suche für die Seite /suche: Treffer als Karten, Kartenpunkte (gerundet) und Gesamtzahl. */
export async function loadSearch(f: SearchFilters, viewer: SessionUser | null) {
  const origin = originOf(f);
  const ctx = await viewerContext(viewer, origin);
  const isMap = f.ansicht === "karte";
  const opts = isMap ? { limit: MAP_LIMIT, offset: 0 } : { limit: PAGE_SIZE, offset: (f.seite - 1) * PAGE_SIZE };
  let rows: { id: string; lat: number | null; lng: number | null }[];
  let cards: ProfileCardData[];
  let total: number;
  if (f.typ === "escort") {
    const res = await searchEscorts(f, ctx, opts);
    rows = res.items;
    total = res.total;
    cards = res.items.map((r) => escortCard(r, viewer));
  } else {
    const res = await searchClubs(f, ctx, opts);
    rows = res.items;
    total = res.total;
    cards = res.items.map((r) => clubCard(r, viewer));
  }
  const stories = await usersWithActiveStory(cards.map((c) => c.id));
  cards = await withFavorites(
    cards.map((c) => (stories.has(c.id) ? { ...c, hasStory: true } : c)),
    viewer,
  );
  const points: MapPoint[] = isMap ? mapPoints(rows, cards) : [];
  return { cards, total, points, origin };
}

/** Filterbare dynamische Club-Felder aus club_type_schemas (ohne Felder mit eigenem Filter). */
export async function loadClubFilterFields(types: string[]): Promise<ClubFilterField[]> {
  const rows = await db.select().from(clubTypeSchemas);
  const seen = new Map<string, ClubFilterField>();
  for (const r of rows) {
    if (types.length && !types.includes(r.clubType)) continue;
    for (const fd of r.fields) {
      if (fd.rule === "hidden" || fd.key === "entryPrice" || fd.key === "wellness" || seen.has(fd.key)) continue;
      if (fd.input === "boolean" || fd.input === "multiselect" || fd.input === "number") {
        seen.set(fd.key, { key: fd.key, label: fd.label, input: fd.input, options: fd.options });
      }
    }
  }
  return [...seen.values()];
}

/**
 * search_impression für angezeigte Treffer, gebündelt in einem Insert nach der Antwort.
 * Gleiche Regeln wie track(): keine Bots, keine eigenen Aufrufe, Besucher-Schlüssel pro Tag.
 */
export async function recordImpressions(profileIds: string[], viewerId: string | null, source: "search" | "matches" = "search") {
  const ids = profileIds.filter((id) => id !== viewerId);
  if (ids.length === 0 || (await isBot())) return;
  const ip = await clientIp();
  const country = await requestCountry();
  const viewerKey = viewerId ?? sha256(`v:${ip}:${new Date().toISOString().slice(0, 10)}`).slice(0, 24);
  after(async () => {
    try {
      await db.insert(analyticsEvents).values(ids.map((profileId) => ({ profileId, type: "search_impression" as const, source, viewerId, viewerKey, country })));
    } catch (err) {
      console.error("[search] Impressionen", err);
    }
  });
}
