"use server";

import { and, desc, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { bookings, memberReviews, reviewReplies, reviews, users } from "@/db/schema";
import { ApiError, requireUser, run } from "@/lib/auth/guards";
import { notify } from "@/lib/notify";
import { writeLimit } from "@/lib/rate-limit";
import { canViewProfile, isBlockedBetween } from "@/lib/visibility";
import { parseRange } from "@/lib/bookings/range";
import { localDate } from "@/lib/bookings/format";
import { criteriaFor, REVIEW_INTERVAL_DAYS } from "./criteria";
import { reviewEligibility, reviewTarget } from "./queries";
import { recomputeRating } from "./rating";

const star = z.number().int().min(1).max(5);

const reviewSchema = z.object({
  targetId: z.uuid(),
  rating: star,
  ratings: z.record(z.string().max(30), star),
  title: z.string().trim().min(3, "Bitte gib einen Titel ein").max(120),
  body: z.string().trim().min(30, "Bitte schreib mindestens 30 Zeichen").max(5000),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  durationMin: z.number().int().min(15).max(1440).optional(),
  bookingId: z.uuid().optional(),
});

function zodMessage(err: unknown) {
  if (err instanceof z.ZodError) return err.issues[0]?.message ?? "Ungültige Eingabe";
  return null;
}

/** Bericht über eine Escort oder einen Club. Ein Bericht pro Mitglied und Profil pro 30 Tage. */
export async function createReview(input: z.input<typeof reviewSchema>) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["member"] });
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) throw new ApiError("INVALID", zodMessage(parsed.error) ?? "Ungültige Eingabe");
    const p = parsed.data;
    await writeLimit(user.id, "review", 5, 3600);
    const [target] = await db.select().from(users).where(eq(users.id, p.targetId));
    if (!target || target.accountType === "member" || !(await canViewProfile(user, target))) throw new ApiError("NOT_FOUND");
    const elig = await reviewEligibility(user, target.id);
    if (!elig.allowed) throw new ApiError("CONFLICT", `Du kannst pro Profil nur alle ${REVIEW_INTERVAL_DAYS} Tage einen Bericht schreiben`);

    const keys = new Set(criteriaFor(target.accountType === "club" ? "club" : "escort").map((c) => c.key));
    const ratings = Object.fromEntries(Object.entries(p.ratings).filter(([k]) => keys.has(k)));

    let verified = false;
    let bookingId: string | null = null;
    let meetingDate = p.meetingDate ?? null;
    let durationMin = p.durationMin ?? null;
    if (p.bookingId) {
      const [b] = await db.select().from(bookings).where(eq(bookings.id, p.bookingId));
      if (!b || b.memberId !== user.id || b.escortId !== target.id || b.status !== "completed") throw new ApiError("INVALID", "Diese Buchung kann nicht verknüpft werden");
      const [used] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, b.id));
      if (used) throw new ApiError("CONFLICT", "Zu dieser Buchung gibt es bereits einen Bericht");
      verified = true;
      bookingId = b.id;
      const range = parseRange(b.during);
      if (range) meetingDate = localDate(range.start);
      durationMin = b.durationMin;
    }
    if (meetingDate && meetingDate > localDate(new Date())) throw new ApiError("INVALID", "Das Treffen darf nicht in der Zukunft liegen");

    const [row] = await db
      .insert(reviews)
      .values({ authorId: user.id, targetId: target.id, rating: p.rating, ratings, title: p.title, body: p.body, meetingDate, durationMin, bookingId, verified })
      .returning({ id: reviews.id });
    await recomputeRating(target.id);
    const t = await reviewTarget(target.id);
    await notify(target.id, { type: "review_new", title: "Neuer Bericht über dich", body: p.title, href: "/dashboard/berichte", actorId: user.id });
    revalidatePath("/dashboard/berichte");
    if (t) revalidatePath(t.writeHref.replace(/\/bericht$/, ""));
    return { id: row!.id, href: t ? `${t.writeHref.replace(/\/bericht$/, "")}#berichte` : "/dashboard/berichte" };
  });
}

const replySchema = z.object({
  reviewId: z.uuid(),
  body: z.string().trim().min(2).max(3000),
  title: z.string().trim().max(120).optional(),
  rating: star.optional(),
});

/** Genau eine öffentliche Antwort der bewerteten Person pro Bericht. */
export async function replyToReview(input: z.input<typeof replySchema>) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["escort", "club"] });
    const p = replySchema.parse(input);
    await writeLimit(user.id, "review-reply", 20, 600);
    const [r] = await db.select().from(reviews).where(eq(reviews.id, p.reviewId));
    if (!r || r.targetId !== user.id) throw new ApiError("FORBIDDEN", "Nur die bewertete Person kann antworten");
    try {
      await db.insert(reviewReplies).values({ reviewId: r.id, authorId: user.id, isOwnerReply: true, body: p.body, title: p.title || null, rating: p.rating ?? null });
    } catch (err) {
      const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") throw new ApiError("CONFLICT", "Du hast auf diesen Bericht bereits geantwortet");
      throw err;
    }
    await notify(r.authorId, { type: "review_reply", title: "Antwort auf deinen Bericht", body: p.title || p.body.slice(0, 80), href: "/dashboard/berichte", actorId: user.id });
    revalidatePath("/dashboard/berichte");
    return { ok: true };
  });
}

/** Weitere Kommentare unter einem Bericht (Thread). */
export async function commentOnReview(input: { reviewId: string; body: string }) {
  return run(async () => {
    const user = await requireUser({ complete: true });
    const p = z.object({ reviewId: z.uuid(), body: z.string().trim().min(2).max(2000) }).parse(input);
    await writeLimit(user.id, "review-comment", 20, 600);
    const [r] = await db.select().from(reviews).where(eq(reviews.id, p.reviewId));
    if (!r || r.hidden) throw new ApiError("NOT_FOUND");
    if ((await isBlockedBetween(user.id, r.targetId)) || (await isBlockedBetween(user.id, r.authorId))) throw new ApiError("FORBIDDEN");
    await db.insert(reviewReplies).values({ reviewId: r.id, authorId: user.id, isOwnerReply: false, body: p.body });
    for (const uid of new Set([r.authorId, r.targetId])) {
      if (uid !== user.id) await notify(uid, { type: "review_comment", title: "Neuer Kommentar zu einem Bericht", body: p.body.slice(0, 80), href: "/dashboard/berichte", actorId: user.id });
    }
    revalidatePath("/dashboard/berichte");
    return { ok: true };
  });
}

const memberReviewSchema = z.object({
  memberId: z.uuid(),
  rating: star,
  reliable: z.boolean().nullable(),
  respectful: z.boolean().nullable(),
  body: z.string().trim().max(2000).optional(),
});

/** Anbieterinnen bewerten Mitglieder (nur für Anbieterinnen sichtbar). */
export async function createMemberReview(input: z.input<typeof memberReviewSchema>) {
  return run(async () => {
    const user = await requireUser({ complete: true, types: ["escort", "club"] });
    const p = memberReviewSchema.parse(input);
    await writeLimit(user.id, "member-review", 10, 3600);
    const [m] = await db.select({ id: users.id, type: users.accountType }).from(users).where(eq(users.id, p.memberId));
    if (!m || m.type !== "member") throw new ApiError("NOT_FOUND");
    const since = new Date(Date.now() - REVIEW_INTERVAL_DAYS * 86400_000);
    const [recent] = await db
      .select({ id: memberReviews.id })
      .from(memberReviews)
      .where(and(eq(memberReviews.authorId, user.id), eq(memberReviews.memberId, m.id), gt(memberReviews.createdAt, since)))
      .orderBy(desc(memberReviews.createdAt))
      .limit(1);
    if (recent) throw new ApiError("CONFLICT", `Du hast dieses Mitglied in den letzten ${REVIEW_INTERVAL_DAYS} Tagen bereits bewertet`);
    await db.insert(memberReviews).values({ authorId: user.id, memberId: m.id, rating: p.rating, reliable: p.reliable, respectful: p.respectful, body: p.body || null });
    revalidatePath("/dashboard/berichte");
    return { ok: true };
  });
}
