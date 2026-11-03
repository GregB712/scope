import { type SQL, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Scope database schema. Design notes live in docs/architecture.md (section 3).
 *
 * Conventions: UUID primary keys, `timestamptz` everywhere, every user-owned row
 * reachable from `newsrooms` through foreign keys with cascading deletes.
 */

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Text-search configuration used by every generated search vector. */
export const SEARCH_CONFIG = "english";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const sourceProvider = pgEnum("source_provider", ["google_drive", "filesystem"]);

export const sectionKind = pgEnum("section_kind", [
  "executive_summary",
  "top_stories",
  "topic_brief",
  "data_snapshot",
  "radar",
  "risk",
  "outlook",
  "sources",
  "other",
]);

export const syncTrigger = pgEnum("sync_trigger", ["manual", "cron", "cli"]);

export const syncStatus = pgEnum("sync_status", [
  "running",
  "succeeded",
  "partial",
  "failed",
  "abandoned",
]);

export const syncStage = pgEnum("sync_stage", ["list", "download", "parse", "persist"]);

// ---------------------------------------------------------------------------
// Newsrooms and configuration
// ---------------------------------------------------------------------------

export const newsrooms = pgTable(
  "newsrooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk user ID of the owner. */
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** IANA timezone used when a report does not state one. */
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("newsrooms_owner_slug_key").on(t.ownerId, t.slug)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    newsroomId: uuid("newsroom_id")
      .notNull()
      .references(() => newsrooms.id, { onDelete: "cascade" }),
    provider: sourceProvider("provider").notNull(),
    /** Drive folder ID, or a path for the filesystem provider. */
    rootRef: text("root_ref").notNull(),
    rootName: text("root_name"),
    enabled: boolean("enabled").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // A folder can be bound to only one newsroom per deployment (architecture 4.4).
    uniqueIndex("sources_provider_root_key").on(t.provider, t.rootRef),
    index("sources_newsroom_idx").on(t.newsroomId),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    newsroomId: uuid("newsroom_id")
      .notNull()
      .references(() => newsrooms.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    aliases: text("aliases")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("topics_newsroom_slug_key").on(t.newsroomId, t.slug)],
);

// ---------------------------------------------------------------------------
// Reports and derived content
// ---------------------------------------------------------------------------

export type OutlineEntry = { depth: number; text: string; slug: string };
export type ParseWarning = { code: string; message: string };
export type SourceLink = { url: string; title: string };

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    newsroomId: uuid("newsroom_id")
      .notNull()
      .references(() => newsrooms.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),

    // Source file metadata
    sourceFileId: text("source_file_id").notNull(),
    sourcePath: text("source_path"),
    sourceFileName: text("source_file_name").notNull(),
    sourceMimeType: text("source_mime_type"),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
    sourceModifiedAt: timestamp("source_modified_at", { withTimezone: true }),
    sourceChecksum: text("source_checksum"),
    sourceMissingAt: timestamp("source_missing_at", { withTimezone: true }),

    // Extracted metadata
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    reportDate: date("report_date", { mode: "string" }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    timezone: text("timezone"),
    researchWindowStart: timestamp("research_window_start", { withTimezone: true }),
    researchWindowEnd: timestamp("research_window_end", { withTimezone: true }),
    researchWindowText: text("research_window_text"),
    summary: text("summary"),
    /** The report's source list (its Sources section, or every external link). */
    sourceLinks: jsonb("source_links").$type<SourceLink[]>().notNull().default([]),

    // Content
    rawMarkdown: text("raw_markdown").notNull(),
    plainText: text("plain_text").notNull(),
    contentHash: text("content_hash").notNull(),
    parserVersion: integer("parser_version").notNull(),
    parseWarnings: jsonb("parse_warnings").$type<ParseWarning[]>().notNull().default([]),
    outline: jsonb("outline").$type<OutlineEntry[]>().notNull().default([]),
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`setweight(to_tsvector('english', ${reports.title}), 'A') || setweight(to_tsvector('english', coalesce(${reports.summary}, '')), 'B') || setweight(to_tsvector('english', ${reports.plainText}), 'C')`,
      ),

    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Idempotency key for synchronization (architecture 3, decision 1).
    uniqueIndex("reports_newsroom_file_key").on(t.newsroomId, t.sourceFileId),
    uniqueIndex("reports_newsroom_slug_key").on(t.newsroomId, t.slug),
    index("reports_newsroom_date_idx").on(t.newsroomId, t.reportDate.desc(), t.generatedAt.desc()),
    index("reports_search_idx").using("gin", t.searchVector),
  ],
);

export const reportSections = pgTable(
  "report_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    depth: smallint("depth").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    kind: sectionKind("kind").notNull().default("other"),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    markdown: text("markdown").notNull(),
  },
  (t) => [
    uniqueIndex("report_sections_report_position_key").on(t.reportId, t.position),
    index("report_sections_topic_idx").on(t.topicId),
  ],
);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    anchor: text("anchor").notNull(),
    categoryRaw: text("category_raw"),
    importance: smallint("importance"),
    confidence: text("confidence"),
    eventDate: date("event_date", { mode: "string" }),
    publishedDate: date("published_date", { mode: "string" }),
    datesText: text("dates_text"),
    summary: text("summary"),
    whyItMatters: text("why_it_matters"),
    implications: text("implications"),
    whatToWatch: text("what_to_watch"),
    extraFields: jsonb("extra_fields").$type<Record<string, string>>().notNull().default({}),
    sourceLinks: jsonb("source_links").$type<SourceLink[]>().notNull().default([]),
    sourceText: text("source_text"),
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`setweight(to_tsvector('english', ${stories.title}), 'A') || setweight(to_tsvector('english', coalesce(${stories.summary}, '')), 'B') || setweight(to_tsvector('english', coalesce(${stories.whyItMatters}, '') || ' ' || coalesce(${stories.implications}, '')), 'C')`,
      ),
  },
  (t) => [
    uniqueIndex("stories_report_position_key").on(t.reportId, t.position),
    index("stories_importance_idx").on(t.importance),
    index("stories_search_idx").using("gin", t.searchVector),
    check("stories_importance_range", sql`${t.importance} between 1 and 10`),
  ],
);

export const storyTopics = pgTable(
  "story_topics",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.storyId, t.topicId] }),
    index("story_topics_topic_idx").on(t.topicId),
  ],
);

/** Derived index maintained by ingestion; rebuildable from stories and sections. */
export const reportTopics = pgTable(
  "report_topics",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    storyCount: integer("story_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.reportId, t.topicId] }),
    index("report_topics_topic_idx").on(t.topicId),
  ],
);

// ---------------------------------------------------------------------------
// Synchronization log
// ---------------------------------------------------------------------------

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    newsroomId: uuid("newsroom_id")
      .notNull()
      .references(() => newsrooms.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    trigger: syncTrigger("trigger").notNull(),
    triggeredBy: text("triggered_by"),
    status: syncStatus("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    filesDiscovered: integer("files_discovered").notNull().default(0),
    filesImported: integer("files_imported").notNull().default(0),
    filesUpdated: integer("files_updated").notNull().default(0),
    filesSkipped: integer("files_skipped").notNull().default(0),
    filesFailed: integer("files_failed").notNull().default(0),
    filesMissing: integer("files_missing").notNull().default(0),
    errorMessage: text("error_message"),
  },
  (t) => [
    // Concurrency lease: at most one running sync per source (architecture 5.2).
    uniqueIndex("sync_runs_one_running_per_source")
      .on(t.sourceId)
      .where(sql`${t.status} = 'running'`),
    index("sync_runs_newsroom_started_idx").on(t.newsroomId, t.startedAt.desc()),
  ],
);

export const syncRunErrors = pgTable(
  "sync_run_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => syncRuns.id, { onDelete: "cascade" }),
    sourceFileId: text("source_file_id"),
    fileName: text("file_name"),
    stage: syncStage("stage").notNull(),
    message: text("message").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sync_run_errors_run_idx").on(t.runId)],
);
