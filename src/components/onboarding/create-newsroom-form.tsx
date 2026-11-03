"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { createNewsroomAction } from "@/server/actions/newsroom";

export function CreateNewsroomForm({
  suggestedTopics,
  timeZones,
}: {
  suggestedTopics: string[];
  timeZones: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const zoneRef = useRef<HTMLSelectElement>(null);

  // Default to the browser's zone, which the server cannot know.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zoneRef.current && zone && timeZones.includes(zone)) zoneRef.current.value = zone;
  }, [timeZones]);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          setError(null);
          const result = await createNewsroomAction({
            name: String(data.get("name") ?? ""),
            description: String(data.get("description") ?? ""),
            timezone: String(data.get("timezone") ?? "UTC"),
            withDefaultTopics: data.get("topics") === "on",
          });
          if (!result.ok) return setError(result.error);
          router.push(`/n/${result.data.slug}/welcome`);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Newsroom name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="Global Intelligence"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          placeholder="Daily briefing on markets, technology and world events."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Time zone</Label>
        <Select id="timezone" name="timezone" ref={zoneRef} defaultValue="UTC">
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex gap-3 rounded-(--radius-control) bg-surface p-4">
        <input
          type="checkbox"
          name="topics"
          defaultChecked
          className="mt-1 size-4 accent-(--signal)"
        />
        <span>
          <span className="block text-ui font-medium">Start with suggested topics</span>
          <span className="mt-1 block text-meta text-ink-secondary">
            {suggestedTopics.join(", ")}. You can rename, remove or add topics at any time.
          </span>
        </span>
      </label>
      <FieldError>{error}</FieldError>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Creating…" : "Create newsroom"}
      </Button>
    </form>
  );
}
