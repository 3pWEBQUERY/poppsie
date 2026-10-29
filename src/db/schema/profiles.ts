import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  breastType,
  clubType,
  connectRule,
  gender,
  intimateStyle,
  linkStatus,
  mediaKind,
  mediaPurpose,
  mediaStatus,
  tattooLevel,
  workplace,
} from "./enums";
import { users } from "./users";

export type PriceItem = { minutes: number; price: number; label?: string };

export const escortProfiles = pgTable(
  "escort_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    slogan: text("slogan"),
    about: text("about"),
    gender: gender("gender"),
    /** Aus dem KYC abgeleitet; nicht frei editierbar, sobald verifiziert. */
    birthDate: date("birth_date"),
    heightCm: integer("height_cm"),
    weightKg: integer("weight_kg"),
    nationality: text("nationality"),
    cupSize: text("cup_size"),
    breastType: breastType("breast_type"),
    intimate: intimateStyle("intimate"),
    piercings: text("piercings").array().notNull().default(sql`'{}'::text[]`),
    tattoos: tattooLevel("tattoos"),
    clothingStyles: text("clothing_styles").array().notNull().default(sql`'{}'::text[]`),
    clothingSize: text("clothing_size"),
    shoeSize: integer("shoe_size"),
    hairColor: text("hair_color"),
    eyeColor: text("eye_color"),
    /** Standort: Stadt + Radius, nie die exakte Adresse. lat/lng = Stadtzentrum. */
    city: text("city"),
    country: text("country").default("CH"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    radiusKm: integer("radius_km").notNull().default(10),
    services: text("services").array().notNull().default(sql`'{}'::text[]`),
    prices: jsonb("prices").$type<PriceItem[]>().notNull().default(sql`'[]'::jsonb`),
    currency: text("currency").notNull().default("CHF"),
    workplace: workplace("workplace"),
    connectEnabled: boolean("connect_enabled").notNull().default(true),
    connectRule: connectRule("connect_rule").notNull().default("all"),
    blurForGuests: boolean("blur_for_guests").notNull().default(true),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("escort_geo_idx").on(t.lat, t.lng),
    index("escort_city_idx").on(t.city),
    index("escort_gender_idx").on(t.gender),
  ],
);

export const profileLanguages = pgTable(
  "profile_languages",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    languageCode: text("language_code").notNull(),
    level: integer("level").notNull().default(3),
  },
  (t) => [primaryKey({ columns: [t.userId, t.languageCode] })],
);

export type OpeningHours = Record<"mo" | "di" | "mi" | "do" | "fr" | "sa" | "so", { from: string; to: string }[]>;

export const clubProfiles = pgTable(
  "club_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name"),
    clubType: clubType("club_type").notNull(),
    description: text("description"),
    /** Dynamische Felder nach club_type_schemas. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    street: text("street"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country").default("CH"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    openingHours: jsonb("opening_hours").$type<Partial<OpeningHours>>().notNull().default(sql`'{}'::jsonb`),
    logoMediaId: uuid("logo_media_id"),
    blurForGuests: boolean("blur_for_guests").notNull().default(false),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_slug_uq").on(t.slug), index("club_geo_idx").on(t.lat, t.lng), index("club_type_idx").on(t.clubType)],
);

export type ClubFieldRule = "required" | "optional" | "hidden";
export type ClubFieldDef = {
  key: string;
  label: string;
  input: "text" | "textarea" | "number" | "money" | "boolean" | "multiselect" | "hours" | "list";
  options?: string[];
  rule: ClubFieldRule;
};

/** JSON-Schema pro Club-Typ: neue Typen ohne Code-Deploy. */
export const clubTypeSchemas = pgTable("club_type_schemas", {
  clubType: text("club_type").primaryKey(),
  label: text("label").notNull(),
  fields: jsonb("fields").$type<ClubFieldDef[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Verknüpfte Girls eines Betriebs; beide Seiten müssen bestätigen. */
export const clubLinks = pgTable(
  "club_links",
  {
    clubId: uuid("club_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    escortId: uuid("escort_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: linkStatus("status").notNull().default("pending"),
    initiatedBy: uuid("initiated_by").notNull(),
    presentOn: date("present_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.escortId] }), index("club_links_escort_idx").on(t.escortId)],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull(),
    purpose: mediaPurpose("purpose").notNull(),
    status: mediaStatus("status").notNull().default("ready"),
    /** Original (EXIF entfernt). Wird Gästen bei aktivem Blur nie ausgeliefert. */
    storageKey: text("storage_key").notNull(),
    blurKey: text("blur_key"),
    thumbKey: text("thumb_key"),
    mime: text("mime").notNull(),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes").notNull(),
    durationSec: integer("duration_sec"),
    fileName: text("file_name"),
    sha256: text("sha256"),
    blurForGuests: boolean("blur_for_guests").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_owner_idx").on(t.ownerId, t.purpose, t.sortOrder), index("media_sha_idx").on(t.sha256)],
);

export const kycVerifications = pgTable(
  "kyc_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("identity"), // identity | photo
    provider: text("provider").notNull().default("manual"),
    providerRef: text("provider_ref"),
    /** Foto-Verifikation: Code, der beim Selfie gezeigt wird. */
    gestureCode: text("gesture_code"),
    status: text("status").notNull().default("pending"), // pending | verified | rejected
    note: text("note"),
    decidedBy: uuid("decided_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("kyc_user_idx").on(t.userId)],
);

/** Länder-Sperre: Besucher aus diesen Ländern sehen das Profil nicht. */
export const visibilityBlocks = pgTable(
  "visibility_blocks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.countryCode] })],
);

/** Ein Eintrag pro Besucher, Profil und Tag (Mehrfachbesuche werden zusammengefasst). */
export const profileVisits = pgTable(
  "profile_visits",
  {
    visitorId: uuid("visitor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visitedId: uuid("visited_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visitDate: date("visit_date").notNull(),
    count: integer("count").notNull().default(1),
    incognito: boolean("incognito").notNull().default(false),
    lastVisitedAt: timestamp("last_visited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.visitorId, t.visitedId, t.visitDate] }), index("visits_visited_idx").on(t.visitedId, t.lastVisitedAt)],
);

export const favoriteFolders = pgTable("favorite_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => favoriteFolders.id, { onDelete: "set null" }),
    note: text("note"),
    notify: boolean("notify").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetId] }), index("favorites_target_idx").on(t.targetId)],
);

/** Präferenzen sind sensibel: criteria wird AES-256-GCM-verschlüsselt gespeichert. */
export const preferences = pgTable("preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  criteriaEnc: text("criteria_enc").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: jsonb("query").$type<Record<string, unknown>>().notNull(),
  notify: boolean("notify").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
