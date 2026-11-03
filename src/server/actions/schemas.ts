import { z } from "zod";
import { isValidTimeZone } from "@/core/time";

export const slugSchema = z.string().min(1).max(120);
export const uuidSchema = z.uuid();

export const newsroomSchema = z.object({
  name: z.string().trim().min(1, "Give your newsroom a name.").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone."),
});

export const topicSchema = z.object({
  name: z.string().trim().min(1, "Topic name is required.").max(80),
  aliases: z.array(z.string().trim().max(80)).max(20).default([]),
  description: z.string().trim().max(300).optional().nullable(),
});

/** "AI, Artificial intelligence" into ["AI", "Artificial intelligence"]. */
export const aliasesFromText = (text: string) =>
  text
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
