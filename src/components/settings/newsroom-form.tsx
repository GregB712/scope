"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { updateNewsroomAction } from "@/server/actions/newsroom";

export function NewsroomForm({
  slug,
  initial,
  timeZones,
}: {
  slug: string;
  initial: { name: string; description: string | null; timezone: string };
  timeZones: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    error?: string;
    saved?: boolean;
    fields?: Record<string, string[]>;
  }>({});

  return (
    <form
      className="max-w-xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updateNewsroomAction(slug, {
            name: String(data.get("name") ?? ""),
            description: String(data.get("description") ?? ""),
            timezone: String(data.get("timezone") ?? ""),
          });
          setStatus(
            result.ok ? { saved: true } : { error: result.error, fields: result.fieldErrors },
          );
          if (result.ok) router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initial.name}
          required
          maxLength={80}
          aria-invalid={!!status.fields?.name}
        />
        <FieldError>{status.fields?.name?.[0]}</FieldError>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial.description ?? ""}
          maxLength={500}
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Time zone</Label>
        <Select id="timezone" name="timezone" defaultValue={initial.timezone}>
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <p className="text-meta text-ink-tertiary">
          Used when a report does not state its own time zone.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {status.saved && !pending && (
          <span role="status" className="text-meta text-ink-secondary">
            Saved.
          </span>
        )}
        {status.error && !status.fields && <FieldError>{status.error}</FieldError>}
      </div>
    </form>
  );
}
