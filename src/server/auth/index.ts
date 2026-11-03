import "server-only";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/server/db/client";
import {
  findOwnedNewsroom,
  listOwnedNewsrooms,
  type AuthorizedNewsroom,
} from "@/server/data/newsroom-access";

export type { AuthorizedNewsroom } from "@/server/data/newsroom-access";

/** Signed-in user ID for pages; redirects to sign-in otherwise. */
export const requireUserId = cache(async (): Promise<string> => {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
});

/**
 * The newsroom in the URL, if the signed-in user owns it. Responds 404 otherwise,
 * so the existence of other users' newsrooms is not revealed.
 */
export const requireNewsroom = cache(async (slug: string): Promise<AuthorizedNewsroom> => {
  const userId = await requireUserId();
  const newsroom = await findOwnedNewsroom(getDb(), userId, slug);
  if (!newsroom) notFound();
  return newsroom;
});

export const getMyNewsrooms = cache(async (): Promise<AuthorizedNewsroom[]> => {
  return listOwnedNewsrooms(getDb(), await requireUserId());
});

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this newsroom.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For Server Actions: never redirects, throws instead. */
export async function authorizeNewsroomAction(
  slug: string,
): Promise<{ userId: string; newsroom: AuthorizedNewsroom }> {
  const { userId } = await auth();
  if (!userId) throw new AuthorizationError("Please sign in again.");
  const newsroom = await findOwnedNewsroom(getDb(), userId, slug);
  if (!newsroom) throw new AuthorizationError();
  return { userId, newsroom };
}
