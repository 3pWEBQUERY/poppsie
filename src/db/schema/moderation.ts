import { bigserial, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { analyticsSource, analyticsType, appealStatus, flagReason, flagStatus, flagTarget, moderationActionType } from "./enums";
import { users } from "./users";

/** Meldungen. Kategorie minor/coercion/trafficking wird mit Priorität 100 eskaliert. */
export const moderationFlags = pgTable(
  "moderation_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: flagTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    targetUserId: uuid("target_user_id"),
    reason: flagReason("reason").notNull(),
    details: text("details"),
    priority: integer("priority").notNull().default(10),
    status: flagStatus("status").notNull().default("open"),
    /** Hinweise der automatischen Prüfung (Nacktheit, Altersschätzung, Hash-Treffer). */
    autoSignals: jsonb("auto_signals").$type<Record<string, unknown>>(),
    resolvedBy: uuid("resolved_by"),
    resolution: text("resolution"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("flags_queue_idx").on(t.status, t.priority, t.createdAt), index("flags_target_idx").on(t.targetType, t.targetId)],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moderatorId: uuid("moderator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    flagId: uuid("flag_id"),
    action: moderationActionType("action").notNull(),
    reason: text("reason").notNull(),
    until: timestamp("until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mod_actions_user_idx").on(t.targetUserId)],
);

export const appeals = pgTable("appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  actionId: uuid("action_id")
    .notNull()
    .references(() => moderationActions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  status: appealStatus("status").notNull().default("open"),
  decidedBy: uuid("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

/** Rohereignisse für Statistiken (Bots und eigene Aufrufe werden beim Schreiben gefiltert). */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: analyticsType("type").notNull(),
    source: analyticsSource("source").notNull().default("direct"),
    viewerId: uuid("viewer_id"),
    viewerKey: text("viewer_key"),
    country: text("country"),
    region: text("region"),
    refId: uuid("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_profile_idx").on(t.profileId, t.createdAt)],
);

/** Stündliche Aggregation der Ereignisse. */
export const analyticsHourly = pgTable(
  "analytics_hourly",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hour: timestamp("hour", { withTimezone: true }).notNull(),
    type: analyticsType("type").notNull(),
    source: analyticsSource("source").notNull(),
    country: text("country").notNull().default(""),
    count: integer("count").notNull().default(0),
    uniques: integer("uniques").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.hour, t.type, t.source, t.country] })],
);
