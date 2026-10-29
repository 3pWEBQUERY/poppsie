import "server-only";
import { count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appeals,
  bookings,
  clubProfiles,
  comments,
  escortProfiles,
  favoriteFolders,
  favorites,
  follows,
  media,
  messages,
  moderationActions,
  moderationFlags,
  notifications,
  posts,
  preferences,
  profileLanguages,
  profileVisits,
  reviews,
  savedSearches,
  stories,
  users,
  visibilityBlocks,
} from "@/db/schema";
import { decrypt } from "@/lib/auth/crypto";
import { env } from "@/lib/env";
import { mediaUrl } from "@/lib/media/urls";

async function usernames(ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map<string, string>();
  const rows = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r.username]));
}

/**
 * Datenexport (Auskunftsrecht revDSG / DSGVO): ausschliesslich Daten der Person selbst.
 * Andere Personen erscheinen höchstens mit ihrem öffentlichen Benutzernamen (z. B. Favoriten, Buchungspartner),
 * nie mit privaten Daten; Besucher des eigenen Profils nur als Tageszahl (Inkognito bleibt geschützt).
 */
export async function buildExport(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return null;
  const account = { ...u, passwordHash: undefined, totpSecret: undefined };

  const [escort] = await db.select().from(escortProfiles).where(eq(escortProfiles.userId, userId));
  const [club] = await db.select().from(clubProfiles).where(eq(clubProfiles.userId, userId));
  const [pref] = await db.select().from(preferences).where(eq(preferences.userId, userId));
  let preferenceCriteria: unknown = null;
  if (pref) {
    try {
      preferenceCriteria = JSON.parse(decrypt(pref.criteriaEnc));
    } catch {
      preferenceCriteria = "(konnte nicht entschlüsselt werden)";
    }
  }

  const [languages, mediaRows, postRows, commentRows, messageRows, written, received, favRows, folders, following, followerCount, bookingRows, visitsMade, visitsReceived, notes, storyRows, searches, blocks, actions, flagsMade] =
    await Promise.all([
      db.select({ language: profileLanguages.languageCode, level: profileLanguages.level }).from(profileLanguages).where(eq(profileLanguages.userId, userId)),
      db.select().from(media).where(eq(media.ownerId, userId)).orderBy(desc(media.createdAt)),
      db.select().from(posts).where(eq(posts.authorId, userId)).orderBy(desc(posts.createdAt)),
      db.select().from(comments).where(eq(comments.authorId, userId)).orderBy(desc(comments.createdAt)),
      db
        .select({ id: messages.id, conversationId: messages.conversationId, type: messages.type, body: messages.body, createdAt: messages.createdAt, editedAt: messages.editedAt, deletedAt: messages.deletedAt })
        .from(messages)
        .where(eq(messages.senderId, userId))
        .orderBy(desc(messages.createdAt)),
      db.select().from(reviews).where(eq(reviews.authorId, userId)).orderBy(desc(reviews.createdAt)),
      db
        .select({ id: reviews.id, title: reviews.title, rating: reviews.rating, ratings: reviews.ratings, body: reviews.body, meetingDate: reviews.meetingDate, verified: reviews.verified, hidden: reviews.hidden, createdAt: reviews.createdAt })
        .from(reviews)
        .where(eq(reviews.targetId, userId))
        .orderBy(desc(reviews.createdAt)),
      db.select().from(favorites).where(eq(favorites.userId, userId)),
      db.select().from(favoriteFolders).where(eq(favoriteFolders.userId, userId)),
      db.select().from(follows).where(eq(follows.followerId, userId)),
      db.select({ n: count() }).from(follows).where(eq(follows.followeeId, userId)),
      db
        .select({
          id: bookings.id,
          escortId: bookings.escortId,
          memberId: bookings.memberId,
          during: bookings.during,
          durationMin: bookings.durationMin,
          price: bookings.price,
          meetingType: bookings.meetingType,
          message: bookings.message,
          status: bookings.status,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .where(or(eq(bookings.escortId, userId), eq(bookings.memberId, userId)))
        .orderBy(desc(bookings.createdAt)),
      db.select().from(profileVisits).where(eq(profileVisits.visitorId, userId)).orderBy(desc(profileVisits.lastVisitedAt)).limit(5000),
      db
        .select({ date: profileVisits.visitDate, visits: sql<number>`sum(${profileVisits.count})`.mapWith(Number) })
        .from(profileVisits)
        .where(eq(profileVisits.visitedId, userId))
        .groupBy(profileVisits.visitDate)
        .orderBy(desc(profileVisits.visitDate)),
      db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)),
      db.select().from(stories).where(eq(stories.authorId, userId)).orderBy(desc(stories.createdAt)),
      db.select().from(savedSearches).where(eq(savedSearches.userId, userId)),
      db.select({ country: visibilityBlocks.countryCode }).from(visibilityBlocks).where(eq(visibilityBlocks.userId, userId)),
      db
        .select({ action: moderationActions.action, reason: moderationActions.reason, until: moderationActions.until, createdAt: moderationActions.createdAt, appealStatus: appeals.status, appealBody: appeals.body })
        .from(moderationActions)
        .leftJoin(appeals, eq(appeals.actionId, moderationActions.id))
        .where(eq(moderationActions.targetUserId, userId)),
      db
        .select({ targetType: moderationFlags.targetType, reason: moderationFlags.reason, details: moderationFlags.details, status: moderationFlags.status, createdAt: moderationFlags.createdAt })
        .from(moderationFlags)
        .where(eq(moderationFlags.reporterId, userId)),
    ]);

  const names = await usernames([
    ...written.map((r) => r.targetId),
    ...favRows.map((f) => f.targetId),
    ...following.map((f) => f.followeeId),
    ...bookingRows.flatMap((b) => [b.escortId, b.memberId]),
    ...visitsMade.map((v) => v.visitedId),
  ]);
  const name = (id: string) => names.get(id) ?? "(gelöschtes Konto)";

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      service: "Poppsie",
      note: "Export deiner personenbezogenen Daten (Art. 25 revDSG / Art. 15 und 20 DSGVO). Medien-Links sind 24 Stunden gültig und nur angemeldet abrufbar.",
    },
    account: { ...account, twoFactorEnabled: Boolean(u.totpSecret) },
    profile: escort ?? club ?? null,
    languages,
    visibilityBlockedCountries: blocks.map((b) => b.country),
    preferences: preferenceCriteria,
    savedSearches: searches,
    media: mediaRows.map((m) => ({
      id: m.id,
      kind: m.kind,
      purpose: m.purpose,
      status: m.status,
      mime: m.mime,
      sizeBytes: m.sizeBytes,
      width: m.width,
      height: m.height,
      fileName: m.fileName,
      blurForGuests: m.blurForGuests,
      createdAt: m.createdAt,
      url: `${env.appUrl}${mediaUrl(m.id, "o", 86400)}`,
    })),
    posts: postRows,
    comments: commentRows,
    stories: storyRows,
    messagesSent: messageRows,
    reviewsWritten: written.map((r) => ({ ...r, targetUsername: name(r.targetId) })),
    reviewsReceived: received,
    favorites: favRows.map((f) => ({ username: name(f.targetId), folderId: f.folderId, note: f.note, notify: f.notify, createdAt: f.createdAt })),
    favoriteFolders: folders,
    following: following.map((f) => ({ username: name(f.followeeId), since: f.createdAt })),
    followerCount: followerCount[0]?.n ?? 0,
    bookings: bookingRows.map((b) => ({
      ...b,
      role: b.escortId === userId ? "anbieterin" : "mitglied",
      counterpart: name(b.escortId === userId ? b.memberId : b.escortId),
      escortId: undefined,
      memberId: undefined,
    })),
    visitsMade: visitsMade.map((v) => ({ username: name(v.visitedId), date: v.visitDate, count: v.count, incognito: v.incognito })),
    visitsReceivedPerDay: visitsReceived,
    notifications: notes.map((n) => ({ type: n.type, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt })),
    moderationDecisions: actions,
    reportsSubmitted: flagsMade,
  };
}
