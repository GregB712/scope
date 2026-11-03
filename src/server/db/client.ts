import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { databaseEnv } from "@/env";
import * as schema from "./schema";
import type { Database } from "./types";

let httpDb: Database | undefined;

/**
 * Database for reads and single-statement writes, over Neon's HTTP driver.
 * HTTP does not support interactive transactions: use {@link withTransactionalDb}
 * when a write spans several statements.
 */
export function getDb(): Database {
  httpDb ??= drizzleHttp(neon(databaseEnv().DATABASE_URL), { schema });
  return httpDb;
}

/**
 * Runs `fn` with a database backed by a short-lived Neon WebSocket pool, which
 * supports `db.transaction()`. The pool is created and closed around `fn`, as
 * Neon recommends for serverless functions.
 */
export async function withTransactionalDb<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: databaseEnv().DATABASE_URL });
  try {
    return await fn(drizzleWs({ client: pool, schema }));
  } finally {
    await pool.end();
  }
}
