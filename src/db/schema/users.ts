import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { accountType, clubType, kycStatus, userRole, userStatus } from "./enums";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    accountType: accountType("account_type").notNull(),
    role: userRole("role").notNull().default("user"),
    status: userStatus("status").notNull().default("active"),
    profileComplete: boolean("profile_complete").notNull().default(false),
    profileScore: integer("profile_score").notNull().default(0),
    kycStatus: kycStatus("kyc_status").notNull().default("none"),
    /** Inkognito: Besuche und Story-Views erscheinen nur mit Milchglas-Avatar. */
    incognito: boolean("incognito").notNull().default(false),
    showOnline: boolean("show_online").notNull().default(true),
    readReceipts: boolean("read_receipts").notNull().default(true),
    /** Hauptschalter "Profil komplett ausblenden". */
    profileHidden: boolean("profile_hidden").notNull().default(false),
    locale: text("locale").notNull().default("de"),
    country: text("country"),
    region: text("region"),
    timezone: text("timezone").notNull().default("Europe/Zurich"),
    bio: text("bio"),
    avatarMediaId: uuid("avatar_media_id"),
    coverMediaId: uuid("cover_media_id"),
    badges: text("badges").array().notNull().default(sql`'{}'::text[]`),
    totpSecret: text("totp_secret"),
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_uq").on(t.username),
    uniqueIndex("users_email_uq").on(t.email),
    index("users_type_idx").on(t.accountType, t.status),
  ],
);

/** Zwischenstand des Registrierungs-Wizards. Der Account entsteht erst nach Code-Bestätigung. */
export const pendingRegistrations = pgTable(
  "pending_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    username: text("username"),
    email: text("email"),
    accountType: accountType("account_type"),
    clubType: clubType("club_type"),
    passwordHash: text("password_hash"),
    locale: text("locale").notNull().default("de"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
    codeHash: text("code_hash"),
    codeSalt: text("code_salt"),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    sendCount: integer("send_count").notNull().default(0),
    sendWindowStart: timestamp("send_window_start", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pending_reg_token_uq").on(t.tokenHash), index("pending_reg_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 des Cookie-Tokens
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Fixed-Window-Rate-Limits (pro IP, E-Mail, User und Aktion). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked_idx").on(t.blockedId)],
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index("follows_followee_idx").on(t.followeeId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    actorId: uuid("actor_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);
