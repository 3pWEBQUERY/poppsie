-- Erweiterungen (Contrib-Module, im offiziellen Postgres-Image enthalten)
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- Doppelbuchungen unmöglich: blockierende Buchungen einer Escort dürfen sich nicht überlappen.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("escort_id" WITH =, "during" WITH &&) WHERE ("blocking");--> statement-breakpoint

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "profile_languages" ADD CONSTRAINT "profile_languages_level_range" CHECK ("level" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "escort_profiles" ADD CONSTRAINT "escort_height_range" CHECK ("height_cm" IS NULL OR "height_cm" BETWEEN 140 AND 210);--> statement-breakpoint
ALTER TABLE "escort_profiles" ADD CONSTRAINT "escort_weight_range" CHECK ("weight_kg" IS NULL OR "weight_kg" BETWEEN 40 AND 150);--> statement-breakpoint

-- Volltextsuche im Forum (Titel + Inhalt) und Benutzernamen-Suche
CREATE INDEX IF NOT EXISTS "threads_title_trgm" ON "forum_threads" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_body_fts" ON "posts" USING gin (to_tsvector('simple', "body"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_trgm" ON "users" USING gin ("username" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_hashtags_gin" ON "posts" USING gin ("hashtags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "escort_services_gin" ON "escort_profiles" USING gin ("services");
