"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_TOPICS } from "@/core/topics/defaults";
import { authorizeAdminAction, authorizeNewsroomAction } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { findOwnedNewsroom } from "@/server/data/newsroom-access";
import { createNewsroom, updateNewsroom } from "@/server/data/newsrooms";
import { createTopics } from "@/server/data/topics";
import { toActionError, type ActionResult } from "./result";
import { newsroomSchema, slugSchema } from "./schemas";

/** Creates a newsroom owned by the signed-in admin, optionally with the suggested topics. */
export async function createNewsroomAction(input: {
  name: string;
  description?: string;
  timezone: string;
  withDefaultTopics?: boolean;
}): Promise<ActionResult<{ slug: string }>> {
  try {
    const { userId } = await authorizeAdminAction();
    const data = newsroomSchema.parse(input);
    const db = getDb();
    const { slug } = await createNewsroom(db, userId, data);
    if (input.withDefaultTopics) {
      const newsroom = (await findOwnedNewsroom(db, userId, slug))!;
      await createTopics(
        db,
        newsroom,
        DEFAULT_TOPICS.map((t) => ({ name: t.name, aliases: [...t.aliases] })),
      );
    }
    return { ok: true, data: { slug } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateNewsroomAction(
  slug: string,
  input: { name: string; description?: string; timezone: string },
): Promise<ActionResult> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    await updateNewsroom(getDb(), newsroom, newsroomSchema.parse(input));
    revalidatePath(`/n/${newsroom.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
