import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Schema = typeof schema;

/**
 * Any Drizzle Postgres database bound to Scope's schema: Neon HTTP (reads),
 * Neon WebSocket pool (transactional writes), or PGlite (tests).
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;
