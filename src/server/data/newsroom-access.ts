import { and, asc, eq } from "drizzle-orm";
import { newsrooms } from "@/server/db/schema";
import type { Database } from "@/server/db/types";

declare const authorized: unique symbol;

/**
 * A newsroom the current user is allowed to read. The brand can only be applied
 * here, after an access check in `@/server/auth`, so every data-access function
 * that takes this type is authorized by construction.
 *
 * Access model (docs/architecture.md section 15): this deployment publishes the
 * newsrooms its admins create. Every signed-in user may read them; only the
 * owning admin may change them (enforced by `authorizeNewsroomAction`).
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

/** Any newsroom by its URL slug. Callers must have checked that the user may read. */
export async function findNewsroom(db: Database, slug: string): Promise<AuthorizedNewsroom | null> {
  const [row] = await db.select(columns).from(newsrooms).where(eq(newsrooms.slug, slug));
  return (row as AuthorizedNewsroom | undefined) ?? null;
}

/** Every newsroom in this deployment, oldest first. */
export async function listNewsrooms(db: Database): Promise<AuthorizedNewsroom[]> {
  const rows = await db.select(columns).from(newsrooms).orderBy(asc(newsrooms.createdAt));
  return rows as AuthorizedNewsroom[];
}

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
