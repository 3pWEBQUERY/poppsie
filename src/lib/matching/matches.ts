import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clubLinks } from "@/db/schema";
import type { ProfileCardData } from "@/components/shared/profile-card";
import type { SessionUser } from "@/lib/auth/session";
import { findCity } from "@/lib/geo/cities";
import { CLUB_TYPES, labelOf } from "@/lib/profile/fields";
import { clubCard, escortCard, withFavorites } from "@/lib/search/cards";
import { searchClubs } from "@/lib/search/clubs";
import { searchEscorts } from "@/lib/search/escorts";
import { parseClubFilters } from "@/lib/search/filters";
import { viewerContext } from "@/lib/search/page-data";
import { usersWithActiveStory } from "@/lib/stories/active";
import type { Criteria } from "./criteria";
import { MATCH_PAGE_SIZE, type MatchQuery } from "./query";
import { mustFilters, scoreEscort } from "./score";

const CANDIDATES = 500;

type Entry = { card: ProfileCardData; score: number; distance: number | null; rating: number; ratingCount: number; createdAt: number; availableToday: boolean };

/**
 * Alle passenden Escorts (Muss-Kriterien als Filter, Score aus Wäre-schön-Kriterien) und Clubs,
 * deren bestätigtes Line-up eine passende Escort enthält (Score = bester Line-up-Score).
 * Profile mit Länder-Sperre für das Mitglied, ausgeblendete und blockierte Profile fallen weg.
 */
export async function findMatches(viewer: SessionUser, criteria: Criteria, q: MatchQuery) {
  const city = criteria.region?.stadt ? findCity(criteria.region.stadt) : null;
  const origin = city ? { lat: city.lat, lng: city.lng } : null;
  const ctx = await viewerContext(viewer, origin);
  const noRadius = criteria.region?.w !== "muss";

  const { items } = await searchEscorts(mustFilters(criteria), ctx, { limit: CANDIDATES, sort: "neu", noRadius });
  const escorts: Entry[] = items.map((r) => {
    const score = scoreEscort(r, criteria);
    return {
      card: { ...escortCard(r, viewer, "matches"), matchScore: score },
      score,
      distance: r.distanceKm,
      rating: r.ratingAvg,
      ratingCount: r.ratingCount,
      createdAt: r.createdAt.getTime(),
      availableToday: r.availableToday,
    };
  });

  const scoreById = new Map(escorts.map((e) => [e.card.id, e.score]));
  let clubs: Entry[] = [];
  if (scoreById.size) {
    const links = await db
      .select({ clubId: clubLinks.clubId, escortId: clubLinks.escortId })
      .from(clubLinks)
      .where(and(eq(clubLinks.status, "accepted"), inArray(clubLinks.escortId, [...scoreById.keys()])));
    const best = new Map<string, { score: number; count: number }>();
    for (const l of links) {
      const s = scoreById.get(l.escortId) ?? 0;
      const b = best.get(l.clubId) ?? { score: 0, count: 0 };
      best.set(l.clubId, { score: Math.max(b.score, s), count: b.count + 1 });
    }
    if (best.size) {
      const cf = parseClubFilters(new URLSearchParams());
      if (criteria.region) cf.radius = criteria.region.radius;
      const res = await searchClubs(cf, ctx, { ids: [...best.keys()], limit: 200, noRadius });
      clubs = res.items.map((r) => {
        const b = best.get(r.id)!;
        const card = clubCard(r, viewer, "matches");
        return {
          card: { ...card, matchScore: b.score, subtitle: `${labelOf(CLUB_TYPES, r.clubType)} · ${b.count} ${b.count === 1 ? "Match" : "Matches"} im Line-up` },
          score: b.score,
          distance: r.distanceKm,
          rating: r.ratingAvg,
          ratingCount: r.ratingCount,
          createdAt: r.createdAt.getTime(),
          availableToday: false,
        };
      });
    }
  }

  let list = q.typ === "escort" ? escorts : q.typ === "club" ? clubs : [...escorts, ...clubs];
  list = list.filter((e) => e.score >= q.min && (!q.heute || e.availableToday));
  const cmp: Record<MatchQuery["sort"], (a: Entry, b: Entry) => number> = {
    score: (a, b) => b.score - a.score || b.rating - a.rating,
    distanz: (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || b.score - a.score,
    bewertung: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount || b.score - a.score,
    neu: (a, b) => b.createdAt - a.createdAt,
  };
  list.sort(cmp[q.sort]);

  const total = list.length;
  const pageItems = list.slice((q.seite - 1) * MATCH_PAGE_SIZE, q.seite * MATCH_PAGE_SIZE).map((e) => e.card);
  const stories = await usersWithActiveStory(pageItems.map((c) => c.id));
  const cards = await withFavorites(
    pageItems.map((c) => (stories.has(c.id) ? { ...c, hasStory: true } : c)),
    viewer,
  );
  return { cards, total, counts: { escort: escorts.length, club: clubs.length }, hasOrigin: Boolean(origin) };
}
