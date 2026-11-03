"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { authorizeNewsroomAction, type AuthorizedNewsroom } from "@/server/auth";
import { getDb, withTransactionalDb } from "@/server/db/client";
import {
  createTopic,
  deleteTopic,
  listTopics,
  reorderTopics,
  updateTopic,
} from "@/server/data/topics";
import { reprocessNewsroom } from "@/server/sync/reprocess";
import { toActionError, type ActionResult } from "./result";
import { slugSchema, topicSchema, uuidSchema } from "./schemas";

/**
 * Topic changes re-link stored reports. That re-parse runs after the response
 * (it can take a few seconds on a large archive), so the editor stays responsive.
 */
function relinkLater(newsroom: AuthorizedNewsroom) {
  after(async () => {
    await withTransactionalDb((db) => reprocessNewsroom(db, newsroom.id));
    revalidatePath(`/n/${newsroom.slug}`, "layout");
  });
  revalidatePath(`/n/${newsroom.slug}`, "layout");
}

type TopicFields = { name: string; aliases: string[]; description?: string | null };

export async function createTopicAction(slug: string, input: TopicFields): Promise<ActionResult> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    await createTopic(getDb(), newsroom, topicSchema.parse(input));
    relinkLater(newsroom);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTopicAction(
  slug: string,
  topicId: string,
  input: TopicFields,
): Promise<ActionResult> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const found = await updateTopic(
      getDb(),
      newsroom,
      uuidSchema.parse(topicId),
      topicSchema.parse(input),
    );
    if (!found) return { ok: false, error: "Topic not found." };
    relinkLater(newsroom);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTopicAction(slug: string, topicId: string): Promise<ActionResult> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const found = await deleteTopic(getDb(), newsroom, uuidSchema.parse(topicId));
    if (!found) return { ok: false, error: "Topic not found." };
    relinkLater(newsroom);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function moveTopicAction(
  slug: string,
  topicId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const db = getDb();
    const ids = (await listTopics(db, newsroom)).map((t) => t.id);
    const index = ids.indexOf(uuidSchema.parse(topicId));
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ids.length) return { ok: true };
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await reorderTopics(db, newsroom, ids);
    revalidatePath(`/n/${newsroom.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Adds a phrase from "Unmapped categories" as an alias of an existing topic. */
export async function addAliasAction(
  slug: string,
  topicId: string,
  phrase: string,
): Promise<ActionResult> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const db = getDb();
    const topic = (await listTopics(db, newsroom)).find((t) => t.id === uuidSchema.parse(topicId));
    if (!topic) return { ok: false, error: "Topic not found." };
    const { name, aliases } = topicSchema.parse({
      name: topic.name,
      aliases: [...topic.aliases, phrase],
    });
    await updateTopic(db, newsroom, topic.id, { name, aliases, description: topic.description });
    relinkLater(newsroom);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
