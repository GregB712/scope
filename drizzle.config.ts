import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read Next.js env files, so load .env.local explicitly.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Migrations use the direct (unpooled) connection when available.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: true,
});
