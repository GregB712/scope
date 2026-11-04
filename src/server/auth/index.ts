import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { accessEnv } from "@/env";
import { getDb } from "@/server/db/client";
import {
  findNewsroom,
  findOwnedNewsroom,
  listNewsrooms,
  listOwnedNewsrooms,
  type AuthorizedNewsroom,
} from "@/server/data/newsroom-access";

export type { AuthorizedNewsroom } from "@/server/data/newsroom-access";

/*
 * Access model: the people listed in ADMIN_EMAILS run this deployment. They create
 * newsrooms, connect sources and edit topics. Everyone else who signs in is a
 * reader: they can read every newsroom, and change nothing.
 */

/** Signed-in user ID for pages; redirects to sign-in otherwise. */
export const requireUserId = cache(async (): Promise<string> => {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
});

/** The signed-in user's verified email addresses, lower-cased. */
export const verifiedEmails = cache(async (): Promise<string[]> => {
  const user = await currentUser();
  return (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
});

/** True when the user has a verified email listed in ADMIN_EMAILS. */
export function hasAdminEmail(emails: readonly string[], admins: readonly string[]): boolean {
  return emails.some((email) => admins.includes(email));
}

/** Whether the signed-in user is an admin of this deployment. */
export const isAdmin = cache(async (): Promise<boolean> => {
  const { ADMIN_EMAILS } = accessEnv();
  if (!ADMIN_EMAILS.length) return false;
  return hasAdminEmail(await verifiedEmails(), ADMIN_EMAILS);
});

/**
 * The newsroom in the URL, for any signed-in user. Responds 404 when it does
 * not exist.
 */
export const requireNewsroom = cache(async (slug: string): Promise<AuthorizedNewsroom> => {
  await requireUserId();
  const newsroom = await findNewsroom(getDb(), slug);
  if (!newsroom) notFound();
  return newsroom;
});

/**
 * Whether the signed-in user may change this newsroom: they own it and are still
 * an admin. Ownership is checked first, so readers never cost a Clerk API call.
 */
export const canEditNewsroom = cache(async (slug: string): Promise<boolean> => {
  const [{ userId }, newsroom] = await Promise.all([auth(), requireNewsroom(slug)]);
  return newsroom.ownerId === userId && (await isAdmin());
});

/** The newsroom in the URL, if the user may change it. Responds 404 otherwise. */
export const requireEditableNewsroom = cache(async (slug: string): Promise<AuthorizedNewsroom> => {
  const newsroom = await requireNewsroom(slug);
  if (!(await canEditNewsroom(slug))) notFound();
  return newsroom;
});

/** Newsrooms the signed-in user owns, oldest first. */
export const getMyNewsrooms = cache(async (): Promise<AuthorizedNewsroom[]> => {
  return listOwnedNewsrooms(getDb(), await requireUserId());
});

/** Every newsroom readers can open, oldest first. */
export const getPublishedNewsrooms = cache(async (): Promise<AuthorizedNewsroom[]> => {
  await requireUserId();
  return listNewsrooms(getDb());
});

export class AuthorizationError extends Error {
  constructor(message = "Only the editor of this newsroom can change it.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For Server Actions that create a newsroom: admins only. Throws instead of redirecting. */
export async function authorizeAdminAction(): Promise<{ userId: string }> {
  const { userId } = await auth();
  if (!userId) throw new AuthorizationError("Please sign in again.");
  if (!(await isAdmin())) throw new AuthorizationError("Only an admin can create a newsroom.");
  return { userId };
}

/**
 * For Server Actions that change a newsroom: the owner, while still an admin.
 * Every mutating action goes through here. Never redirects; throws instead.
 */
export async function authorizeNewsroomAction(
  slug: string,
): Promise<{ userId: string; newsroom: AuthorizedNewsroom }> {
  const { userId } = await auth();
  if (!userId) throw new AuthorizationError("Please sign in again.");
  const newsroom = await findOwnedNewsroom(getDb(), userId, slug);
  if (!newsroom || !(await isAdmin())) throw new AuthorizationError();
  return { userId, newsroom };
}
