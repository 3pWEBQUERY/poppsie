import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings, bookings, escortProfiles, reviews } from "@/db/schema";
import { getSummaries } from "@/lib/users/summary";
import { DEFAULT_TZ } from "./format";
import { parseRange } from "./range";
import type { BookingStatus, BookingView } from "./types";

type Row = typeof bookings.$inferSelect;

async function toViews(rows: Row[], viewerId: string): Promise<BookingView[]> {
  if (rows.length === 0) return [];
  const escortIds = [...new Set(rows.map((r) => r.escortId))];
  const people = await getSummaries([...escortIds, ...rows.map((r) => r.memberId)], { id: viewerId });
  const meta = await db
    .select({ id: escortProfiles.userId, currency: escortProfiles.currency, tz: bookingSettings.timezone })
    .from(escortProfiles)
    .leftJoin(bookingSettings, eq(bookingSettings.userId, escortProfiles.userId))
    .where(inArray(escortProfiles.userId, escortIds));
  const metaMap = new Map(meta.map((m) => [m.id, m]));
  const reviewed = await db
    .select({ bookingId: reviews.bookingId })
    .from(reviews)
    .where(inArray(reviews.bookingId, rows.map((r) => r.id)));
  const reviewedSet = new Set(reviewed.map((r) => r.bookingId));
  return rows.map((r) => {
    const during = parseRange(r.during);
    const counter = parseRange(r.counterDuring);
    const e = people.get(r.escortId);
    const m = people.get(r.memberId);
    const mm = metaMap.get(r.escortId);
    return {
      id: r.id,
      escortId: r.escortId,
      memberId: r.memberId,
      escortName: e?.name ?? "Escort",
      memberName: m?.name ?? "Mitglied",
      escortUsername: e?.username ?? "",
      memberUsername: m?.username ?? "",
      escortHref: e?.href ?? "#",
      memberHref: m?.href ?? "#",
      escortAvatarUrl: e?.avatarUrl ?? null,
      memberAvatarUrl: m?.avatarUrl ?? null,
      start: during?.start.toISOString() ?? r.createdAt.toISOString(),
      end: during?.end.toISOString() ?? r.createdAt.toISOString(),
      counterStart: counter?.start.toISOString() ?? null,
      counterEnd: counter?.end.toISOString() ?? null,
      durationMin: r.durationMin,
      price: r.price,
      currency: mm?.currency ?? "CHF",
      meetingType: r.meetingType,
      message: r.message,
      status: r.status as BookingStatus,
      holdUntil: r.holdUntil?.toISOString() ?? null,
      blocking: r.blocking,
      timezone: mm?.tz ?? DEFAULT_TZ,
      conversationId: r.conversationId,
      reviewed: reviewedSet.has(r.id),
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Buchungen für Buchungskarten laden (nur Beteiligte). */
export async function getBookingViews(ids: string[], viewerId: string): Promise<Map<string, BookingView>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await db
    .select()
    .from(bookings)
    .where(and(inArray(bookings.id, unique), or(eq(bookings.escortId, viewerId), eq(bookings.memberId, viewerId))));
  const views = await toViews(rows, viewerId);
  return new Map(views.map((v) => [v.id, v]));
}

export async function getBookingView(id: string, viewerId: string) {
  return (await getBookingViews([id], viewerId)).get(id) ?? null;
}

/** Alle Buchungen eines Users (als Escort oder Mitglied), neueste Termine zuerst. */
export async function listBookings(userId: string, role: "escort" | "member", limit = 200) {
  const rows = await db
    .select()
    .from(bookings)
    .where(role === "escort" ? eq(bookings.escortId, userId) : eq(bookings.memberId, userId))
    .orderBy(desc(sql`lower(${bookings.during})`))
    .limit(limit);
  return toViews(rows, userId);
}

const OPEN: BookingStatus[] = ["requested", "countered"];

/** Gruppierung für Listen: Anfragen, bevorstehend, vergangen. */
export function groupBookings(list: BookingView[], now = Date.now()) {
  const requests = list.filter((b) => OPEN.includes(b.status) && new Date(b.end).getTime() > now).sort(byStart);
  const upcoming = list.filter((b) => b.status === "confirmed" && new Date(b.end).getTime() > now).sort(byStart);
  const past = list.filter((b) => !requests.includes(b) && !upcoming.includes(b));
  return { requests, upcoming, past };
}

function byStart(a: BookingView, b: BookingView) {
  return a.start.localeCompare(b.start);
}
