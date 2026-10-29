import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contentContext, groupMemberStatus, groupPrivacy, groupRole, postVisibility, reactionKind, reactionTarget } from "./enums";
import { media } from "./profiles";
import { users } from "./users";

export type Embed = { type: "profile" | "thread" | "post" | "group" | "highlight"; id: string };

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    rules: text("rules"),
    coverMediaId: uuid("cover_media_id"),
    privacy: groupPrivacy("privacy").notNull().default("public"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requirePostApproval: boolean("require_post_approval").notNull().default(false),
    region: text("region"),
    memberCount: integer("member_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groups_region_idx").on(t.region)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRole("role").notNull().default("member"),
    status: groupMemberStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

/** Forum-Kategorien; mit group_id gehört die Kategorie zum Gruppen-Forum. */
export const forumCategories = pgTable(
  "forum_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Kontotypen mit Lese-/Schreibrecht; leer = alle. */
    readTypes: text("read_types").array().notNull().default(sql`'{}'::text[]`),
    writeTypes: text("write_types").array().notNull().default(sql`'{}'::text[]`),
    adultOnlyMedia: boolean("adult_only_media").notNull().default(false),
  },
  (t) => [index("forum_cat_parent_idx").on(t.parentId)],
);

export const forumCategoryModerators = pgTable(
  "forum_category_moderators",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => forumCategories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.userId] })],
);

export const forumThreads = pgTable(
  "forum_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => forumCategories.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    prefix: text("prefix"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    pinned: boolean("pinned").notNull().default(false),
    locked: boolean("locked").notNull().default(false),
    solved: boolean("solved").notNull().default(false),
    replyCount: integer("reply_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    lastPostAt: timestamp("last_post_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("threads_cat_idx").on(t.categoryId, t.pinned, t.lastPostAt)],
);

export const forumSubscriptions = pgTable(
  "forum_subscriptions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.threadId] })],
);

export const forumReads = pgTable(
  "forum_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.threadId] })],
);

export const polls = pgTable("polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => forumThreads.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  multiple: boolean("multiple").notNull().default(false),
  closesAt: timestamp("closes_at", { withTimezone: true }),
});

export const pollOptions = pgTable("poll_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollId: uuid("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const pollVotes = pgTable(
  "poll_votes",
  {
    optionId: uuid("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.userId] })],
);

/**
 * Gemeinsames Content-Modul: Feed-Posts, Gruppen-Posts und Forum-Beiträge.
 * body ist Markdown-Light (fett, kursiv, Links, @Erwähnungen, #Hashtags), gerendert im Client.
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    context: contentContext("context").notNull(),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => forumThreads.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id"),
    body: text("body").notNull().default(""),
    visibility: postVisibility("visibility").notNull().default("public"),
    embeds: jsonb("embeds").$type<Embed[]>().notNull().default(sql`'[]'::jsonb`),
    hashtags: text("hashtags").array().notNull().default(sql`'{}'::text[]`),
    approved: boolean("approved").notNull().default(true),
    isDraft: boolean("is_draft").notNull().default(false),
    commentCount: integer("comment_count").notNull().default(0),
    reactionCount: integer("reaction_count").notNull().default(0),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("posts_feed_idx").on(t.context, t.createdAt),
    index("posts_author_idx").on(t.authorId, t.createdAt),
    index("posts_group_idx").on(t.groupId, t.createdAt),
    index("posts_thread_idx").on(t.threadId, t.createdAt),
  ],
);

export const postMedia = pgTable(
  "post_media",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.mediaId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    depth: integer("depth").notNull().default(0),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    mediaId: uuid("media_id"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt)],
);

export const reactions = pgTable(
  "reactions",
  {
    targetType: reactionTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: reactionKind("kind").notNull().default("like"),
    /** Für Nachrichten-Reaktionen: beliebiges Emoji (Unicode). */
    emoji: text("emoji"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.targetType, t.targetId, t.userId] })],
);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    overlayText: text("overlay_text"),
    /** Sticker: { type: "city" | "available_today" | "book_link", value?, x, y } */
    stickers: jsonb("stickers").$type<{ type: string; value?: string; x: number; y: number }[]>().notNull().default(sql`'[]'::jsonb`),
    highlight: boolean("highlight").notNull().default(false),
    highlightTitle: text("highlight_title"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stories_author_idx").on(t.authorId, t.expiresAt)],
);

export const storyViews = pgTable(
  "story_views",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    viewerId: uuid("viewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    incognito: boolean("incognito").notNull().default(false),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.viewerId] })],
);

export const storyComments = pgTable(
  "story_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("story_comments_idx").on(t.storyId, t.createdAt)],
);
