import { and, asc, eq } from "drizzle-orm";
import { newsrooms } from "@/server/db/schema";
import type { Database } from "@/server/db/types";

declare const authorized: unique symbol;

/**
 * A newsroom the current user is allowed to access. The brand can only be
 * applied here, after an ownership check, so every data-access function that
 * takes this type is authorized by construction.
 */
export type AuthorizedNewsroom = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly timezone: string;
  readonly [authorized]: true;
};

const columns = {
  id: newsrooms.id,
  ownerId: newsrooms.ownerId,
  name: newsrooms.name,
  slug: newsrooms.slug,
  description: newsrooms.description,
  timezone: newsrooms.timezone,
};

export async function findOwnedNewsroom(
  db: Database,
  userId: string,
  slug: string,
): Promise<AuthorizedNewsroom | null> {
  const [row] = await db
    .select(columns)
    .from(newsrooms)
    .where(and(eq(newsrooms.ownerId, userId), eq(newsrooms.slug, slug)));
  return (row as AuthorizedNewsroom | undefined) ?? null;
}

export async function listOwnedNewsrooms(
  db: Database,
  userId: string,
): Promise<AuthorizedNewsroom[]> {
  const rows = await db
    .select(columns)
    .from(newsrooms)
    .where(eq(newsrooms.ownerId, userId))
    .orderBy(asc(newsrooms.createdAt));
  return rows as AuthorizedNewsroom[];
}
