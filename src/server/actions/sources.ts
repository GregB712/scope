"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeNewsroomAction } from "@/server/auth";
import { getDb, withTransactionalDb } from "@/server/db/client";
import { bindSource, getSource, setSourceEnabled } from "@/server/data/sources";
import { getSourceProvider, SourceError, type ProviderId } from "@/server/sources";
import { parseDriveFolderRef } from "@/server/sources/google-drive/folder-ref";
import { syncSourceById, type SyncResult } from "@/server/sync";
import { reprocessNewsroom } from "@/server/sync/reprocess";
import { toActionError, type ActionResult } from "./result";
import { slugSchema, uuidSchema } from "./schemas";

const folderInput = z.object({
  provider: z.enum(["google_drive", "filesystem"]),
  folder: z.string().trim().min(1, "Paste the folder link or ID.").max(500),
});

function rootRefFor(provider: ProviderId, folder: string): string {
  if (provider === "filesystem") return folder;
  const id = parseDriveFolderRef(folder);
  if (!id)
    throw new SourceError("That does not look like a Google Drive folder link or ID.", "invalid");
  return id;
}

/** The signed-in user's verified email addresses, lower-cased. */
async function verifiedEmails(): Promise<string[]> {
  const user = await currentUser();
  return (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
}

/**
 * Checks the folder and returns what Scope would import, without saving.
 * Enforces that a Drive folder with a known owner belongs to the user
 * (docs/architecture.md section 4.4).
 */
async function inspectFolder(input: z.infer<typeof folderInput>) {
  const provider = getSourceProvider(input.provider);
  const rootRef = rootRefFor(input.provider, input.folder);
  const root = await provider.verifyRoot(rootRef);
  if (root.ownerEmails.length) {
    const mine = await verifiedEmails();
    if (!root.ownerEmails.some((email) => mine.includes(email))) {
      throw new SourceError(
        "This folder is owned by a different Google account. Sign in with the account that owns it, or add that email to your profile.",
        "forbidden",
      );
    }
  }
  const listing = await provider.listFiles(rootRef);
  return { rootRef, name: root.name, fileCount: listing.files.length };
}

export async function previewFolderAction(
  slug: string,
  input: { provider: ProviderId; folder: string },
): Promise<ActionResult<{ name: string; fileCount: number }>> {
  try {
    await authorizeNewsroomAction(slugSchema.parse(slug));
    const { name, fileCount } = await inspectFolder(folderInput.parse(input));
    return { ok: true, data: { name, fileCount } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function connectFolderAction(
  slug: string,
  input: { provider: ProviderId; folder: string },
): Promise<ActionResult<{ sourceId: string; name: string; fileCount: number }>> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const parsed = folderInput.parse(input);
    const folder = await inspectFolder(parsed);
    const source = await bindSource(getDb(), newsroom, {
      provider: parsed.provider,
      rootRef: folder.rootRef,
      rootName: folder.name,
    });
    revalidatePath(`/n/${newsroom.slug}`, "layout");
    return {
      ok: true,
      data: { sourceId: source.id, name: folder.name, fileCount: folder.fileCount },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setSourceEnabledAction(
  slug: string,
  sourceId: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const found = await setSourceEnabled(
      getDb(),
      newsroom,
      uuidSchema.parse(sourceId),
      z.boolean().parse(enabled),
    );
    if (!found) return { ok: false, error: "Source not found." };
    revalidatePath(`/n/${newsroom.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function syncNowAction(
  slug: string,
  sourceId: string,
): Promise<ActionResult<SyncResult>> {
  try {
    const { userId, newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const source = await getSource(getDb(), newsroom, uuidSchema.parse(sourceId));
    if (!source) return { ok: false, error: "Source not found." };
    const result = await syncSourceById(source.id, "manual", userId);
    revalidatePath(`/n/${newsroom.slug}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reprocessAction(
  slug: string,
): Promise<ActionResult<{ reprocessed: number; failed: number }>> {
  try {
    const { newsroom } = await authorizeNewsroomAction(slugSchema.parse(slug));
    const result = await withTransactionalDb((db) => reprocessNewsroom(db, newsroom.id));
    revalidatePath(`/n/${newsroom.slug}`, "layout");
    return { ok: true, data: { reprocessed: result.reprocessed, failed: result.failed.length } };
  } catch (error) {
    return toActionError(error);
  }
}
