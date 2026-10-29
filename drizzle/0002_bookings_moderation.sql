CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"kind" text DEFAULT 'unavailable' NOT NULL,
	"start_min" integer,
	"end_min" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'Europe/Zurich' NOT NULL,
	"buffer_min" integer DEFAULT 15 NOT NULL,
	"min_lead_min" integer DEFAULT 60 NOT NULL,
	"durations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"accepts_incall" boolean DEFAULT true NOT NULL,
	"accepts_outcall" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escort_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"during" "tstzrange" NOT NULL,
	"duration_min" integer NOT NULL,
	"price" integer,
	"meeting_type" "meeting_type" DEFAULT 'incall' NOT NULL,
	"message" text,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"blocking" boolean DEFAULT true NOT NULL,
	"hold_until" timestamp with time zone,
	"counter_during" "tstzrange",
	"conversation_id" uuid,
	"reminder24_sent_at" timestamp with time zone,
	"reminder2_sent_at" timestamp with time zone,
	"review_invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"locked_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"reliable" boolean,
	"respectful" boolean,
	"rating" smallint NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"is_owner_reply" boolean DEFAULT false NOT NULL,
	"title" text,
	"rating" smallint,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"title" text,
	"rating" smallint NOT NULL,
	"ratings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"body" text NOT NULL,
	"meeting_date" date,
	"duration_min" integer,
	"booking_id" uuid,
	"verified" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "scheduled_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'Europe/Zurich' NOT NULL,
	"status" "scheduled_status" DEFAULT 'scheduled' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" "analytics_type" NOT NULL,
	"source" "analytics_source" DEFAULT 'direct' NOT NULL,
	"viewer_id" uuid,
	"viewer_key" text,
	"country" text,
	"region" text,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_hourly" (
	"profile_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"type" "analytics_type" NOT NULL,
	"source" "analytics_source" NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"uniques" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_hourly_profile_id_hour_type_source_country_pk" PRIMARY KEY("profile_id","hour","type","source","country")
);
--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "appeal_status" DEFAULT 'open' NOT NULL,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderator_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"flag_id" uuid,
	"action" "moderation_action_type" NOT NULL,
	"reason" text NOT NULL,
	"until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" "flag_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"target_user_id" uuid,
	"reason" "flag_reason" NOT NULL,
	"details" text,
	"priority" integer DEFAULT 10 NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"auto_signals" jsonb,
	"resolved_by" uuid,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_settings" ADD CONSTRAINT "booking_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_escort_id_users_id_fk" FOREIGN KEY ("escort_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_reviews" ADD CONSTRAINT "member_reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_reviews" ADD CONSTRAINT "member_reviews_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_actions" ADD CONSTRAINT "scheduled_actions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_profile_id_users_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_hourly" ADD CONSTRAINT "analytics_hourly_profile_id_users_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_action_id_moderation_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_exc_user_idx" ON "availability_exceptions" USING btree ("user_id","date_from");--> statement-breakpoint
CREATE INDEX "availability_user_idx" ON "availability_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_escort_idx" ON "bookings" USING btree ("escort_id","status");--> statement-breakpoint
CREATE INDEX "bookings_member_idx" ON "bookings" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "jobs" USING btree ("done_at","run_at");--> statement-breakpoint
CREATE INDEX "member_reviews_idx" ON "member_reviews" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "review_replies_idx" ON "review_replies" USING btree ("review_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_owner_reply_uq" ON "review_replies" USING btree ("review_id") WHERE "review_replies"."is_owner_reply";--> statement-breakpoint
CREATE INDEX "reviews_target_idx" ON "reviews" USING btree ("target_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_author_idx" ON "reviews" USING btree ("author_id","target_id","created_at");--> statement-breakpoint
CREATE INDEX "scheduled_due_idx" ON "scheduled_actions" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "scheduled_owner_idx" ON "scheduled_actions" USING btree ("owner_id","run_at");--> statement-breakpoint
CREATE INDEX "analytics_profile_idx" ON "analytics_events" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mod_actions_user_idx" ON "moderation_actions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "flags_queue_idx" ON "moderation_flags" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE INDEX "flags_target_idx" ON "moderation_flags" USING btree ("target_type","target_id");