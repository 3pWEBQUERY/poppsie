import "server-only";
import { and, asc, desc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, clubProfiles, memberReviews, reviewReplies, reviews, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { getSummaries, type UserSummary } from "@/lib/users/summary";
import { REVIEW_INTERVAL_DAYS } from "./criteria";

export type ReplyItem = { id: string; body: string; title: string | null; rating: number | null; isOwnerReply: boolean; createdAt: string; author: UserSummary | null };

export type ReviewItem = {
  id: string;
  targetId: string;
  title: string | null;
  rating: number;
  ratings: Record<string, number>;
  body: string;
  meetingDate: string | null;
  durationMin: number | null;
  verified: boolean;
  createdAt: string;
  author: UserSummary | null;
  target: UserSummary | null;
  ownerReply: ReplyItem | null;
  comments: ReplyItem[];
};

export type ReviewStats = { avg: number; count: number; distribution: number[]; criteria: Record<string, number> };

type ReviewRow = typeof reviews.$inferSelect;

async function hydrate(rows: ReviewRow[], viewer: { id: string } | null): Promise<ReviewItem[]> {
  if (rows.length === 0) return [];
  const replies = await db
    .select()
    .from(reviewReplies)
    .where(inArray(reviewReplies.reviewId, rows.map((r) => r.id)))
    .orderBy(asc(reviewReplies.createdAt));
  const people = await getSummaries([...rows.flatMap((r) => [r.authorId, r.targetId]), ...replies.map((r) => r.authorId)], viewer);
  const toReply = (r: typeof reviewReplies.$inferSelect): ReplyItem => ({
    id: r.id,
    body: r.body,
    title: r.title,
    rating: r.rating,
    isOwnerReply: r.isOwnerReply,
    createdAt: r.createdAt.toISOString(),
    author: people.get(r.authorId) ?? null,
  });
  return rows.map((r) => {
    const own = replies.filter((x) => x.reviewId === r.id);
    const owner = own.find((x) => x.isOwnerReply);
    return {
      id: r.id,
      targetId: r.targetId,
      title: r.title,
      rating: r.rating,
      ratings: r.ratings,
      body: r.body,
      meetingDate: r.meetingDate,
      durationMin: r.durationMin,
      verified: r.verified,
      createdAt: r.createdAt.toISOString(),
      author: people.get(r.authorId) ?? null,
      target: people.get(r.targetId) ?? null,
      ownerReply: owner ? toReply(owner) : null,
      comments: own.filter((x) => !x.isOwnerReply).map(toReply),
    };
  });
}

function stats(rows: ReviewRow[]): ReviewStats {
  const distribution = [0, 0, 0, 0, 0];
  const sums: Record<string, { s: number; n: number }> = {};
  for (const r of rows) {
    distribution[5 - r.rating] = (distribution[5 - r.rating] ?? 0) + 1;
    for (const [k, v] of Object.entries(r.ratings ?? {})) {
      sums[k] ??= { s: 0, n: 0 };
      sums[k].s += v;
      sums[k].n += 1;
    }
  }
  const count = rows.length;
  const avg = count ? rows.reduce((a, r) => a + r.rating, 0) / count : 0;
  return { avg, count, distribution, criteria: Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v.s / v.n])) };
}

/** Berichte eines Profils (ohne ausgeblendete) inkl. Statistik. */
export async function getProfileReviews(targetId: string, viewer: { id: string } | null, limit = 100) {
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.targetId, targetId), eq(reviews.hidden, false)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
  return { items: await hydrate(rows, viewer), stats: stats(rows) };
}

export async function getWrittenReviews(authorId: string) {
  const rows = await db.select().from(reviews).where(eq(reviews.authorId, authorId)).orderBy(desc(reviews.createdAt)).limit(200);
  return hydrate(rows, { id: authorId });
}

export async function getReceivedReviews(targetId: string) {
  return getProfileReviews(targetId, { id: targetId }, 200);
}

/** Darf der Betrachter (jetzt) einen Bericht über das Profil schreiben? */
export async function reviewEligibility(viewer: SessionUser | null, targetId: string) {
  if (!viewer) return { allowed: false as const, reason: "login" as const };
  if (viewer.accountType !== "member") return { allowed: false as const, reason: "type" as const };
  const since = new Date(Date.now() - REVIEW_INTERVAL_DAYS * 86400_000);
  const [last] = await db
    .select({ createdAt: reviews.createdAt })
    .from(reviews)
    .where(and(eq(reviews.authorId, viewer.id), eq(reviews.targetId, targetId), gt(reviews.createdAt, since)))
    .orderBy(desc(reviews.createdAt))
    .limit(1);
  if (last) return { allowed: false as const, reason: "interval" as const, nextDate: new Date(last.createdAt.getTime() + REVIEW_INTERVAL_DAYS * 86400_000).toISOString() };
  return { allowed: true as const };
}

/** Erledigte Buchungen des Mitglieds bei der Escort, zu denen noch kein Bericht existiert. */
export async function verifiableBookings(memberId: string, escortId: string) {
  const used = db.select({ id: reviews.bookingId }).from(reviews).where(and(eq(reviews.authorId, memberId), sql`${reviews.bookingId} IS NOT NULL`));
  return db
    .select({ id: bookings.id, during: bookings.during, durationMin: bookings.durationMin })
    .from(bookings)
    .where(and(eq(bookings.memberId, memberId), eq(bookings.escortId, escortId), eq(bookings.status, "completed"), notInArray(bookings.id, used)))
    .orderBy(desc(bookings.updatedAt))
    .limit(10);
}

/** Zielprofil eines Berichts (Escort oder Club) für Links. */
export async function reviewTarget(targetId: string) {
  const [row] = await db
    .select({ id: users.id, username: users.username, accountType: users.accountType, slug: clubProfiles.slug })
    .from(users)
    .leftJoin(clubProfiles, eq(clubProfiles.userId, users.id))
    .where(eq(users.id, targetId));
  if (!row) return null;
  return { ...row, writeHref: row.accountType === "club" ? `/club/${row.slug ?? row.username}/bericht` : `/escort/${row.username}/bericht` };
}

export type MemberReviewItem = {
  id: string;
  rating: number;
  reliable: boolean | null;
  respectful: boolean | null;
  body: string | null;
  createdAt: string;
  author: UserSummary | null;
};

export async function getMemberReviews(memberId: string, viewer: { id: string }) {
  const rows = await db.select().from(memberReviews).where(eq(memberReviews.memberId, memberId)).orderBy(desc(memberReviews.createdAt)).limit(100);
  const people = await getSummaries(rows.map((r) => r.authorId), viewer);
  const items: MemberReviewItem[] = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    reliable: r.reliable,
    respectful: r.respectful,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: people.get(r.authorId) ?? null,
  }));
  const count = rows.length;
  return {
    items,
    avg: count ? rows.reduce((a, r) => a + r.rating, 0) / count : 0,
    reliable: rows.filter((r) => r.reliable === true).length,
    respectful: rows.filter((r) => r.respectful === true).length,
    count,
  };
}

/** Mitglieder aus erledigten Terminen, die die Anbieterin noch nicht bewertet hat. */
export async function membersToRate(providerId: string) {
  const rated = db.select({ id: memberReviews.memberId }).from(memberReviews).where(eq(memberReviews.authorId, providerId));
  const rows = await db
    .selectDistinct({ memberId: bookings.memberId })
    .from(bookings)
    .where(and(eq(bookings.escortId, providerId), inArray(bookings.status, ["completed", "no_show"]), notInArray(bookings.memberId, rated)))
    .limit(20);
  const people = await getSummaries(rows.map((r) => r.memberId), { id: providerId });
  return rows.map((r) => people.get(r.memberId)).filter((x): x is UserSummary => Boolean(x));
}


/** Erledigte Buchungen eines Mitglieds ohne Bericht (Einladungen). */
export async function pendingReviewInvites(memberId: string) {
  const used = db.select({ id: reviews.bookingId }).from(reviews).where(and(eq(reviews.authorId, memberId), sql`${reviews.bookingId} IS NOT NULL`));
  const rows = await db
    .select({ id: bookings.id, escortId: bookings.escortId, during: bookings.during })
    .from(bookings)
    .where(and(eq(bookings.memberId, memberId), eq(bookings.status, "completed"), notInArray(bookings.id, used)))
    .orderBy(desc(bookings.updatedAt))
    .limit(10);
  const people = await getSummaries(rows.map((r) => r.escortId), { id: memberId });
  return rows.map((r) => ({ id: r.id, during: r.during, escort: people.get(r.escortId) ?? null }));
}
