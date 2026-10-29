/** URL-Parameter der Seite "Meine Matches" (rein, auch im Client). */
import { z } from "zod";

export const MATCH_SORTS = ["score", "distanz", "bewertung", "neu"] as const;
export type MatchSort = (typeof MATCH_SORTS)[number];
export const MATCH_SORT_LABELS: Record<MatchSort, string> = { score: "Score", distanz: "Distanz", bewertung: "Bewertung", neu: "Neu" };
export const MATCH_TYPES = ["alle", "escort", "club"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
export const MATCH_PAGE_SIZE = 24;

export type MatchQuery = { typ: MatchType; sort: MatchSort; min: number; heute: boolean; seite: number };

type Input = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseMatchQuery(sp: Input): MatchQuery {
  return {
    typ: z.enum(MATCH_TYPES).catch("alle").parse(first(sp.typ)),
    sort: z.enum(MATCH_SORTS).catch("score").parse(first(sp.sort)),
    min: z.coerce.number().int().min(0).max(100).catch(0).parse(first(sp.min)),
    heute: first(sp.heute) === "1",
    seite: z.coerce.number().int().min(1).max(200).catch(1).parse(first(sp.seite)),
  };
}

export function matchHref(q: MatchQuery) {
  const p = new URLSearchParams();
  if (q.typ !== "alle") p.set("typ", q.typ);
  if (q.sort !== "score") p.set("sort", q.sort);
  if (q.min > 0) p.set("min", String(q.min));
  if (q.heute) p.set("heute", "1");
  if (q.seite > 1) p.set("seite", String(q.seite));
  const qs = p.toString();
  return qs ? `/dashboard/matches?${qs}` : "/dashboard/matches";
}
