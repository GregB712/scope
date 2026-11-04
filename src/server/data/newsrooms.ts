import { eq, sql } from "drizzle-orm";
import { slugify } from "@/core/slug";
import { newsrooms } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { AuthorizedNewsroom } from "./newsroom-access";

export type NewsroomInput = { name: string; description?: string | null; timezone: string };

/** Slugs are unique across the deployment, since readers open any newsroom by URL. */
async function uniqueSlug(db: Database, name: string, exceptId?: string) {
  const base = slugify(name) || "newsroom";
  const rows = await db
    .select({ id: newsrooms.id, slug: newsrooms.slug })
    .from(newsrooms)
    .where(sql`${newsrooms.slug} like ${base + "%"}`);
  const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Creates a newsroom owned by `ownerId` (the signed-in Clerk user). */
export async function createNewsroom(db: Database, ownerId: string, input: NewsroomInput) {
  const [row] = await db
    .insert(newsrooms)
    .values({
      ownerId,
      name: input.name.trim(),
      slug: await uniqueSlug(db, input.name),
      description: input.description?.trim() || null,
      timezone: input.timezone,
    })
    .returning({ id: newsrooms.id, slug: newsrooms.slug });
  return row!;
}

/** Updates name, description and time zone. The slug (URL) stays stable. */
export async function updateNewsroom(
  db: Database,
  newsroom: AuthorizedNewsroom,
  input: NewsroomInput,
) {
  await db
    .update(newsrooms)
    .set({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      timezone: input.timezone,
    })
    .where(eq(newsrooms.id, newsroom.id));
}
