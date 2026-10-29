CREATE TYPE "public"."account_type" AS ENUM('member', 'escort', 'club');--> statement-breakpoint
CREATE TYPE "public"."analytics_source" AS ENUM('search', 'feed', 'story', 'matches', 'favorites', 'profile', 'external', 'direct');--> statement-breakpoint
CREATE TYPE "public"."analytics_type" AS ENUM('profile_view', 'search_impression', 'search_click', 'story_view', 'story_like', 'story_comment', 'favorite_add', 'follow', 'chat_start', 'booking_request', 'booking_confirmed');--> statement-breakpoint
CREATE TYPE "public"."appeal_status" AS ENUM('open', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'countered', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show', 'expired');--> statement-breakpoint
CREATE TYPE "public"."breast_type" AS ENUM('natuerlich', 'operiert');--> statement-breakpoint
CREATE TYPE "public"."club_type" AS ENUM('club', 'studio', 'laufhaus', 'kontaktbar', 'saunaclub', 'nachtclub');--> statement-breakpoint
CREATE TYPE "public"."connect_rule" AS ENUM('all', 'verified', 'with_review', 'followers');--> statement-breakpoint
CREATE TYPE "public"."content_context" AS ENUM('feed', 'group', 'forum');--> statement-breakpoint
CREATE TYPE "public"."flag_reason" AS ENUM('minor', 'coercion', 'trafficking', 'spam', 'abuse', 'fake', 'privacy', 'illegal', 'other');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."flag_target" AS ENUM('profile', 'post', 'comment', 'review', 'message', 'story', 'group', 'thread', 'media');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('frau', 'trans', 'mann', 'divers');--> statement-breakpoint
CREATE TYPE "public"."group_member_status" AS ENUM('active', 'pending', 'invited', 'banned');--> statement-breakpoint
CREATE TYPE "public"."group_privacy" AS ENUM('public', 'private', 'secret');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('owner', 'admin', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."intimate_style" AS ENUM('rasiert', 'teilrasiert', 'natuerlich');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."link_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'audio', 'file');--> statement-breakpoint
CREATE TYPE "public"."media_purpose" AS ENUM('gallery', 'avatar', 'cover', 'logo', 'post', 'message', 'story', 'comment', 'group');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('processing', 'ready', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('incall', 'outcall');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'media', 'booking_card', 'system');--> statement-breakpoint
CREATE TYPE "public"."moderation_action_type" AS ENUM('warn', 'remove_content', 'suspend_temp', 'suspend_perm', 'unsuspend', 'kyc_approve', 'kyc_reject', 'hide_profile', 'restore_profile');--> statement-breakpoint
CREATE TYPE "public"."post_visibility" AS ENUM('public', 'followers', 'members');--> statement-breakpoint
CREATE TYPE "public"."reaction_kind" AS ENUM('like', 'love', 'fire', 'laugh', 'wow', 'sad');--> statement-breakpoint
CREATE TYPE "public"."reaction_target" AS ENUM('post', 'comment', 'story', 'message');--> statement-breakpoint
CREATE TYPE "public"."scheduled_status" AS ENUM('scheduled', 'running', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scheduled_type" AS ENUM('story', 'location', 'broadcast');--> statement-breakpoint
CREATE TYPE "public"."tattoo_level" AS ENUM('keine', 'wenige', 'viele');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."workplace" AS ENUM('incall', 'outcall', 'both');--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"actor_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "pending_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"username" text,
	"email" text,
	"account_type" "account_type",
	"club_type" "club_type",
	"password_hash" text,
	"locale" text DEFAULT 'de' NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"age_confirmed_at" timestamp with time zone,
	"code_hash" text,
	"code_salt" text,
	"code_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_count" integer DEFAULT 0 NOT NULL,
	"send_window_start" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"account_type" "account_type" NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"profile_complete" boolean DEFAULT false NOT NULL,
	"profile_score" integer DEFAULT 0 NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'none' NOT NULL,
	"incognito" boolean DEFAULT false NOT NULL,
	"show_online" boolean DEFAULT true NOT NULL,
	"read_receipts" boolean DEFAULT true NOT NULL,
	"profile_hidden" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'de' NOT NULL,
	"country" text,
	"region" text,
	"timezone" text DEFAULT 'Europe/Zurich' NOT NULL,
	"bio" text,
	"avatar_media_id" uuid,
	"cover_media_id" uuid,
	"badges" text[] DEFAULT '{}'::text[] NOT NULL,
	"totp_secret" text,
	"suspended_until" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_links" (
	"club_id" uuid NOT NULL,
	"escort_id" uuid NOT NULL,
	"status" "link_status" DEFAULT 'pending' NOT NULL,
	"initiated_by" uuid NOT NULL,
	"present_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_links_club_id_escort_id_pk" PRIMARY KEY("club_id","escort_id")
);
--> statement-breakpoint
CREATE TABLE "club_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text,
	"club_type" "club_type" NOT NULL,
	"description" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"street" text,
	"postal_code" text,
	"city" text,
	"country" text DEFAULT 'CH',
	"lat" double precision,
	"lng" double precision,
	"opening_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo_media_id" uuid,
	"blur_for_guests" boolean DEFAULT false NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_type_schemas" (
	"club_type" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"fields" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escort_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"slogan" text,
	"about" text,
	"gender" "gender",
	"birth_date" date,
	"height_cm" integer,
	"weight_kg" integer,
	"nationality" text,
	"cup_size" text,
	"breast_type" "breast_type",
	"intimate" "intimate_style",
	"piercings" text[] DEFAULT '{}'::text[] NOT NULL,
	"tattoos" "tattoo_level",
	"clothing_styles" text[] DEFAULT '{}'::text[] NOT NULL,
	"clothing_size" text,
	"shoe_size" integer,
	"hair_color" text,
	"eye_color" text,
	"city" text,
	"country" text DEFAULT 'CH',
	"lat" double precision,
	"lng" double precision,
	"radius_km" integer DEFAULT 10 NOT NULL,
	"services" text[] DEFAULT '{}'::text[] NOT NULL,
	"prices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"workplace" "workplace",
	"connect_enabled" boolean DEFAULT true NOT NULL,
	"connect_rule" "connect_rule" DEFAULT 'all' NOT NULL,
	"blur_for_guests" boolean DEFAULT true NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"folder_id" uuid,
	"note" text,
	"notify" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_target_id_pk" PRIMARY KEY("user_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text DEFAULT 'identity' NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_ref" text,
	"gesture_code" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"purpose" "media_purpose" NOT NULL,
	"status" "media_status" DEFAULT 'ready' NOT NULL,
	"storage_key" text NOT NULL,
	"blur_key" text,
	"thumb_key" text,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer NOT NULL,
	"duration_sec" integer,
	"file_name" text,
	"sha256" text,
	"blur_for_guests" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"criteria_enc" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_languages" (
	"user_id" uuid NOT NULL,
	"language_code" text NOT NULL,
	"level" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "profile_languages_user_id_language_code_pk" PRIMARY KEY("user_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "profile_visits" (
	"visitor_id" uuid NOT NULL,
	"visited_id" uuid NOT NULL,
	"visit_date" date NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"incognito" boolean DEFAULT false NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_visits_visitor_id_visited_id_visit_date_pk" PRIMARY KEY("visitor_id","visited_id","visit_date")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"notify" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visibility_blocks" (
	"user_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	CONSTRAINT "visibility_blocks_user_id_country_code_pk" PRIMARY KEY("user_id","country_code")
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_links" ADD CONSTRAINT "club_links_club_id_users_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_links" ADD CONSTRAINT "club_links_escort_id_users_id_fk" FOREIGN KEY ("escort_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_profiles" ADD CONSTRAINT "club_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escort_profiles" ADD CONSTRAINT "escort_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_folders" ADD CONSTRAINT "favorite_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_folder_id_favorite_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."favorite_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_languages" ADD CONSTRAINT "profile_languages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_visits" ADD CONSTRAINT "profile_visits_visitor_id_users_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_visits" ADD CONSTRAINT "profile_visits_visited_id_users_id_fk" FOREIGN KEY ("visited_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visibility_blocks" ADD CONSTRAINT "visibility_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_reg_token_uq" ON "pending_registrations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "pending_reg_email_idx" ON "pending_registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_type_idx" ON "users" USING btree ("account_type","status");--> statement-breakpoint
CREATE INDEX "club_links_escort_idx" ON "club_links" USING btree ("escort_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_slug_uq" ON "club_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "club_geo_idx" ON "club_profiles" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "club_type_idx" ON "club_profiles" USING btree ("club_type");--> statement-breakpoint
CREATE INDEX "escort_geo_idx" ON "escort_profiles" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "escort_city_idx" ON "escort_profiles" USING btree ("city");--> statement-breakpoint
CREATE INDEX "escort_gender_idx" ON "escort_profiles" USING btree ("gender");--> statement-breakpoint
CREATE INDEX "favorites_target_idx" ON "favorites" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "kyc_user_idx" ON "kyc_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "media" USING btree ("owner_id","purpose","sort_order");--> statement-breakpoint
CREATE INDEX "media_sha_idx" ON "media" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "visits_visited_idx" ON "profile_visits" USING btree ("visited_id","last_visited_at");