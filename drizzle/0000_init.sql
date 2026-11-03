CREATE TYPE "public"."section_kind" AS ENUM('executive_summary', 'top_stories', 'topic_brief', 'data_snapshot', 'radar', 'risk', 'outlook', 'sources', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_provider" AS ENUM('google_drive', 'filesystem');--> statement-breakpoint
CREATE TYPE "public"."sync_stage" AS ENUM('list', 'download', 'parse', 'persist');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'succeeded', 'partial', 'failed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."sync_trigger" AS ENUM('manual', 'cron', 'cli');--> statement-breakpoint
CREATE TABLE "newsrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"depth" smallint NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "section_kind" DEFAULT 'other' NOT NULL,
	"topic_id" uuid,
	"markdown" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_topics" (
	"report_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"story_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "report_topics_report_id_topic_id_pk" PRIMARY KEY("report_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"newsroom_id" uuid NOT NULL,
	"source_id" uuid,
	"source_file_id" text NOT NULL,
	"source_path" text,
	"source_file_name" text NOT NULL,
	"source_mime_type" text,
	"source_created_at" timestamp with time zone,
	"source_modified_at" timestamp with time zone,
	"source_checksum" text,
	"source_missing_at" timestamp with time zone,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"report_date" date NOT NULL,
	"generated_at" timestamp with time zone,
	"timezone" text,
	"research_window_start" timestamp with time zone,
	"research_window_end" timestamp with time zone,
	"research_window_text" text,
	"summary" text,
	"raw_markdown" text NOT NULL,
	"plain_text" text NOT NULL,
	"content_hash" text NOT NULL,
	"parser_version" integer NOT NULL,
	"parse_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "reports"."title"), 'A') || setweight(to_tsvector('english', coalesce("reports"."summary", '')), 'B') || setweight(to_tsvector('english', "reports"."plain_text"), 'C')) STORED NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"newsroom_id" uuid NOT NULL,
	"provider" "source_provider" NOT NULL,
	"root_ref" text NOT NULL,
	"root_name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"anchor" text NOT NULL,
	"category_raw" text,
	"importance" smallint,
	"confidence" text,
	"event_date" date,
	"published_date" date,
	"dates_text" text,
	"summary" text,
	"why_it_matters" text,
	"implications" text,
	"what_to_watch" text,
	"extra_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_text" text,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "stories"."title"), 'A') || setweight(to_tsvector('english', coalesce("stories"."summary", '')), 'B') || setweight(to_tsvector('english', coalesce("stories"."why_it_matters", '') || ' ' || coalesce("stories"."implications", '')), 'C')) STORED NOT NULL,
	CONSTRAINT "stories_importance_range" CHECK ("stories"."importance" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "story_topics" (
	"story_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "story_topics_story_id_topic_id_pk" PRIMARY KEY("story_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "sync_run_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_file_id" text,
	"file_name" text,
	"stage" "sync_stage" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"newsroom_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"trigger" "sync_trigger" NOT NULL,
	"triggered_by" text,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"files_discovered" integer DEFAULT 0 NOT NULL,
	"files_imported" integer DEFAULT 0 NOT NULL,
	"files_updated" integer DEFAULT 0 NOT NULL,
	"files_skipped" integer DEFAULT 0 NOT NULL,
	"files_failed" integer DEFAULT 0 NOT NULL,
	"files_missing" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"newsroom_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_sections" ADD CONSTRAINT "report_sections_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_sections" ADD CONSTRAINT "report_sections_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_topics" ADD CONSTRAINT "report_topics_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_topics" ADD CONSTRAINT "report_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_newsroom_id_newsrooms_id_fk" FOREIGN KEY ("newsroom_id") REFERENCES "public"."newsrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_newsroom_id_newsrooms_id_fk" FOREIGN KEY ("newsroom_id") REFERENCES "public"."newsrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_topics" ADD CONSTRAINT "story_topics_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_topics" ADD CONSTRAINT "story_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run_errors" ADD CONSTRAINT "sync_run_errors_run_id_sync_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_newsroom_id_newsrooms_id_fk" FOREIGN KEY ("newsroom_id") REFERENCES "public"."newsrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_newsroom_id_newsrooms_id_fk" FOREIGN KEY ("newsroom_id") REFERENCES "public"."newsrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newsrooms_owner_slug_key" ON "newsrooms" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "report_sections_report_position_key" ON "report_sections" USING btree ("report_id","position");--> statement-breakpoint
CREATE INDEX "report_sections_topic_idx" ON "report_sections" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "report_topics_topic_idx" ON "report_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_newsroom_file_key" ON "reports" USING btree ("newsroom_id","source_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_newsroom_slug_key" ON "reports" USING btree ("newsroom_id","slug");--> statement-breakpoint
CREATE INDEX "reports_newsroom_date_idx" ON "reports" USING btree ("newsroom_id","report_date" DESC NULLS LAST,"generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_search_idx" ON "reports" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_provider_root_key" ON "sources" USING btree ("provider","root_ref");--> statement-breakpoint
CREATE INDEX "sources_newsroom_idx" ON "sources" USING btree ("newsroom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stories_report_position_key" ON "stories" USING btree ("report_id","position");--> statement-breakpoint
CREATE INDEX "stories_importance_idx" ON "stories" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "stories_search_idx" ON "stories" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "story_topics_topic_idx" ON "story_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "sync_run_errors_run_idx" ON "sync_run_errors" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_runs_one_running_per_source" ON "sync_runs" USING btree ("source_id") WHERE "sync_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "sync_runs_newsroom_started_idx" ON "sync_runs" USING btree ("newsroom_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "topics_newsroom_slug_key" ON "topics" USING btree ("newsroom_id","slug");