import { sql } from "drizzle-orm";
import { boolean, customType, date, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { bookingStatus, meetingType, scheduledStatus, scheduledType } from "./enums";
import { users } from "./users";

/** tstzrange als String im Format '[2026-10-29T14:00:00Z,2026-10-29T15:00:00Z)'. */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tstzrange";
  },
});

export const bookingSettings = pgTable("booking_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Europe/Zurich"),
  bufferMin: integer("buffer_min").notNull().default(15),
  minLeadMin: integer("min_lead_min").notNull().default(60),
  /** Buchbare Dauern mit Preis, z. B. 30 min, 1 h, 2 h, Nacht (720 min). */
  durations: jsonb("durations").$type<{ minutes: number; price: number }[]>().notNull().default(sql`'[]'::jsonb`),
  acceptsIncall: boolean("accepts_incall").notNull().default(true),
  acceptsOutcall: boolean("accepts_outcall").notNull().default(false),
  enabled: boolean("enabled").notNull().default(false),
});

/** Wiederkehrende Verfügbarkeit, Minuten seit Mitternacht in der Zeitzone der Escort. */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = Montag … 6 = Sonntag
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
  },
  (t) => [index("availability_user_idx").on(t.userId)],
);

/** Ausnahmen: Ferien/Abwesenheit (unavailable) oder Zusatzzeiten (extra). */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to").notNull(),
    kind: text("kind").notNull().default("unavailable"),
    startMin: integer("start_min"),
    endMin: integer("end_min"),
    note: text("note"),
  },
  (t) => [index("availability_exc_user_idx").on(t.userId, t.dateFrom)],
);

/**
 * Buchungen. Überlappungen verhindert ein Exclusion-Constraint (siehe Migration 0001_constraints):
 * EXCLUDE USING gist (escort_id WITH =, during WITH &&) WHERE (blocking).
 * blocking = true für bestätigte Termine und für Anfragen während der 30-Minuten-Reservierung.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    escortId: uuid("escort_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    during: tstzrange("during").notNull(),
    durationMin: integer("duration_min").notNull(),
    price: integer("price"),
    meetingType: meetingType("meeting_type").notNull().default("incall"),
    message: text("message"),
    status: bookingStatus("status").notNull().default("requested"),
    blocking: boolean("blocking").notNull().default(true),
    holdUntil: timestamp("hold_until", { withTimezone: true }),
    counterDuring: tstzrange("counter_during"),
    conversationId: uuid("conversation_id"),
    reminder24SentAt: timestamp("reminder24_sent_at", { withTimezone: true }),
    reminder2SentAt: timestamp("reminder2_sent_at", { withTimezone: true }),
    reviewInvitedAt: timestamp("review_invited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bookings_escort_idx").on(t.escortId, t.status), index("bookings_member_idx").on(t.memberId, t.status)],
);

/** Berichte über Escorts und Clubs (Tabelle "reviews", um Verwechslung mit Meldungen zu vermeiden). */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    rating: smallint("rating").notNull(),
    /** Teilbewertungen, z. B. { photos: 5, service: 4, friendliness: 5, punctuality: 4 } */
    ratings: jsonb("ratings").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    body: text("body").notNull(),
    meetingDate: date("meeting_date"),
    durationMin: integer("duration_min"),
    bookingId: uuid("booking_id"),
    verified: boolean("verified").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_target_idx").on(t.targetId, t.createdAt), index("reviews_author_idx").on(t.authorId, t.targetId, t.createdAt)],
);

/** Genau eine öffentliche Antwort der bewerteten Person (is_owner_reply), darunter Thread-Kommentare. */
export const reviewReplies = pgTable(
  "review_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isOwnerReply: boolean("is_owner_reply").notNull().default(false),
    title: text("title"),
    rating: smallint("rating"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("review_replies_idx").on(t.reviewId, t.createdAt),
    uniqueIndex("review_owner_reply_uq").on(t.reviewId).where(sql`${t.isOwnerReply}`),
  ],
);

/** Berichte von Anbieterinnen über Mitglieder; nur für Anbieterinnen sichtbar. */
export const memberReviews = pgTable(
  "member_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reliable: boolean("reliable"),
    respectful: boolean("respectful"),
    rating: smallint("rating").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("member_reviews_idx").on(t.memberId)],
);

/** Planer: Story, Standortwechsel oder Broadcast, ausgeführt durch den Job-Worker. */
export const scheduledActions = pgTable(
  "scheduled_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: scheduledType("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull().default("Europe/Zurich"),
    status: scheduledStatus("status").notNull().default("scheduled"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scheduled_due_idx").on(t.status, t.runAt), index("scheduled_owner_idx").on(t.ownerId, t.runAt)],
);

/** Allgemeine Job-Queue (Postgres, FOR UPDATE SKIP LOCKED) mit Retry. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_due_idx").on(t.doneAt, t.runAt)],
);
