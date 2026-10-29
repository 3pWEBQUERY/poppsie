/**
 * Gespeicherte Suchen: stündlich neue Treffer seit lastCheckedAt suchen und per notify() melden.
 * Läuft im Worker – deshalb nur reine Module (kein next/headers, kein "server-only").
 */
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { savedSearches, users } from "@/db/schema";
import { notify } from "@/lib/notify";
import { countClubs } from "@/lib/search/clubs";
import { describeFilters } from "@/lib/search/describe";
import { countEscorts } from "@/lib/search/escorts";
import { originOf, parseFilters, searchHref } from "@/lib/search/filters";
import type { JobHandler, Periodic } from "./types";

const HOUR = 3600_000;
const BATCH = 200;

type Due = { id: string; userId: string; name: string; query: Record<string, unknown>; lastCheckedAt: Date; country: string | null };

async function checkOne(s: Due) {
  const checkedAt = new Date();
  const params = new URLSearchParams(Object.entries(s.query).map(([k, v]) => [k, String(v)]));
  const f = parseFilters(params);
  // Im Worker gibt es keine Geo-IP: es gilt das Profil-Land des Mitglieds (Länder-Sperren).
  const ctx = { viewerId: s.userId, countries: s.country ? [s.country] : [], origin: originOf(f) };
  const opts = { newSince: s.lastCheckedAt };
  const n = f.typ === "escort" ? await countEscorts(f, ctx, opts) : await countClubs(f, ctx, opts);
  if (n > 0) {
    await notify(s.userId, {
      type: "saved_search",
      title: n === 1 ? `1 neuer Treffer für „${s.name}“` : `${n} neue Treffer für „${s.name}“`,
      body: describeFilters(f).slice(0, 4).join(" · ") || undefined,
      href: searchHref({ ...f, sort: "neu", seite: 1 }),
    });
  }
  await db.update(savedSearches).set({ lastCheckedAt: checkedAt }).where(eq(savedSearches.id, s.id));
  return n;
}

const dueSelect = {
  id: savedSearches.id,
  userId: savedSearches.userId,
  name: savedSearches.name,
  query: savedSearches.query,
  lastCheckedAt: savedSearches.lastCheckedAt,
  country: users.country,
};

export async function checkSavedSearches() {
  // Etwas Spielraum, damit Suchen nicht wegen Sekunden eine Runde überspringen.
  const cutoff = new Date(Date.now() - HOUR + 5 * 60_000);
  let total = 0;
  for (let round = 0; round < 50; round++) {
    const due = await db
      .select(dueSelect)
      .from(savedSearches)
      .innerJoin(users, eq(users.id, savedSearches.userId))
      .where(and(eq(savedSearches.notify, true), lt(savedSearches.lastCheckedAt, cutoff), eq(users.status, "active")))
      .orderBy(savedSearches.lastCheckedAt)
      .limit(BATCH);
    for (const s of due) {
      try {
        total += await checkOne(s);
      } catch (err) {
        console.error(`[saved-searches] Suche ${s.id} fehlgeschlagen`, err);
        await db.update(savedSearches).set({ lastCheckedAt: new Date() }).where(eq(savedSearches.id, s.id));
      }
    }
    if (due.length < BATCH) break;
  }
  if (total) console.log(`[saved-searches] ${total} neue Treffer gemeldet`);
}

export const handlers: Record<string, JobHandler> = {
  /** Einzelne Suche sofort prüfen: enqueue("saved-search.check", { id }). */
  "saved-search.check": async (payload) => {
    const id = String(payload.id ?? "");
    const [s] = await db.select(dueSelect).from(savedSearches).innerJoin(users, eq(users.id, savedSearches.userId)).where(eq(savedSearches.id, id));
    if (s) await checkOne(s);
  },
};

export const periodic: Periodic[] = [{ name: "saved-searches", everyMs: HOUR, run: checkSavedSearches }];
