import "server-only";
import { z } from "zod";

/**
 * Server environment, validated on first use.
 *
 * Validation is lazy and split per subsystem so that, for example, `next build`
 * or the parser tests do not require Google credentials. Each accessor throws a
 * readable error naming the missing variable.
 */

const databaseSchema = z.object({
  DATABASE_URL: z.url({ message: "DATABASE_URL must be a Postgres connection URL" }),
});

const cronSchema = z.object({
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
});

const googleSchema = z.object({
  GOOGLE_SERVICE_ACCOUNT_KEY: z
    .string()
    .min(1, "GOOGLE_SERVICE_ACCOUNT_KEY is not set. See docs/google-drive-setup.md"),
});

const syncSchema = z.object({
  SYNC_TIME_BUDGET_MS: z.coerce.number().int().positive().default(240_000),
  ENABLE_FILESYSTEM_SOURCE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  FILESYSTEM_SOURCE_ROOT: z.string().optional(),
});

function parse<T extends z.ZodType>(schema: T, name: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid ${name} environment configuration:\n${issues}`);
  }
  return result.data;
}

function memo<T>(fn: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= fn());
}

export const databaseEnv = memo(() => parse(databaseSchema, "database"));
export const cronEnv = memo(() => parse(cronSchema, "cron"));
export const googleEnv = memo(() => parse(googleSchema, "Google Drive"));
export const syncEnv = memo(() => {
  const env = parse(syncSchema, "sync");
  return {
    ...env,
    // The filesystem source is a development aid and is never enabled in production.
    ENABLE_FILESYSTEM_SOURCE: env.ENABLE_FILESYSTEM_SOURCE && process.env.NODE_ENV !== "production",
  };
});

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}
