"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { aliasesFromText } from "@/server/actions/schemas";
import {
  addAliasAction,
  createTopicAction,
  deleteTopicAction,
  moveTopicAction,
  updateTopicAction,
} from "@/server/actions/topics";
import type { ActionResult } from "@/server/actions/result";

type Topic = { id: string; name: string; aliases: string[]; description: string | null };

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, success?: string) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) return setError(result.error);
      setNotice(success ?? null);
      router.refresh();
    });
  return { pending, error, notice, run };
}

const RELINK = "Saved. Stored briefings are being re-linked in the background.";

export function TopicEditor({ slug, topics }: { slug: string; topics: Topic[] }) {
  const { pending, error, notice, run } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {topics.length > 0 && (
        <ol className="hairline-list border-y border-separator">
          {topics.map((topic, index) =>
            editing === topic.id ? (
              <li key={topic.id} className="py-4">
                <TopicFields
                  initial={topic}
                  submitLabel="Save"
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(input) => {
                    run(() => updateTopicAction(slug, topic.id, input), RELINK);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={topic.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-medium">{topic.name}</p>
                  <p className="truncate text-meta text-ink-tertiary">
                    {topic.aliases.length
                      ? `Also matches: ${topic.aliases.join(", ")}`
                      : "No aliases"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${topic.name} up`}
                    disabled={pending || index === 0}
                    onClick={() => run(() => moveTopicAction(slug, topic.id, "up"))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${topic.name} down`}
                    disabled={pending || index === topics.length - 1}
                    onClick={() => run(() => moveTopicAction(slug, topic.id, "down"))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(topic.id)}>
                    Edit
                  </Button>
                  {confirming === topic.id ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => {
                        run(() => deleteTopicAction(slug, topic.id), RELINK);
                        setConfirming(null);
                      }}
                    >
                      Confirm delete
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setConfirming(topic.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      <section aria-labelledby="add-topic">
        <h3 id="add-topic" className="mb-3 text-ui font-semibold">
          Add a topic
        </h3>
        <TopicFields
          key={topics.length}
          submitLabel="Add topic"
          pending={pending}
          onSubmit={(input) => run(() => createTopicAction(slug, input), RELINK)}
        />
      </section>

      {(error || notice) && (
        <p
          role="status"
          className={error ? "text-meta text-danger" : "text-meta text-ink-secondary"}
        >
          {error ?? notice}
        </p>
      )}
    </div>
  );
}

function TopicFields({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: Topic;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: { name: string; aliases: string[] }) => void;
  onCancel?: () => void;
}) {
  const [nameError, setNameError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") ?? "").trim();
        if (!name) return setNameError("Topic name is required.");
        setNameError(null);
        onSubmit({ name, aliases: aliasesFromText(String(data.get("aliases") ?? "")) });
        if (!initial) event.currentTarget.reset();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`name-${initial?.id ?? "new"}`}>Name</Label>
        <Input
          id={`name-${initial?.id ?? "new"}`}
          name="name"
          defaultValue={initial?.name}
          maxLength={80}
          placeholder="Cybersecurity"
          aria-invalid={!!nameError}
        />
        <FieldError>{nameError}</FieldError>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`aliases-${initial?.id ?? "new"}`}>Also matches (comma separated)</Label>
        <Input
          id={`aliases-${initial?.id ?? "new"}`}
          name="aliases"
          defaultValue={initial?.aliases.join(", ")}
          placeholder="Cyber, Security"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant={initial ? "primary" : "secondary"} disabled={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** Categories written by the automation that match no topic yet. */
export function UnmappedCategories({
  slug,
  phrases,
  topics,
}: {
  slug: string;
  phrases: { phrase: string; count: number }[];
  topics: Topic[];
}) {
  const { pending, error, notice, run } = useAction();
  if (!phrases.length) {
    return (
      <p className="text-ui text-ink-secondary">
        Every category in your briefings matches a topic.
      </p>
    );
  }
  return (
    <div>
      <ul className="hairline-list border-y border-separator">
        {phrases.map(({ phrase, count }) => (
          <li key={phrase} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-ui">{phrase}</p>
              <p className="text-meta text-ink-tertiary">
                {count} {count === 1 ? "story" : "stories"}
              </p>
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => createTopicAction(slug, { name: phrase, aliases: [] }), RELINK)
              }
            >
              Add as topic
            </Button>
            {topics.length > 0 && (
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const topicId = String(new FormData(event.currentTarget).get("topic"));
                  run(() => addAliasAction(slug, topicId, phrase), RELINK);
                }}
              >
                <Select
                  name="topic"
                  aria-label={`Topic for ${phrase}`}
                  className="h-8 w-48 text-meta"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" type="submit" variant="ghost" disabled={pending}>
                  Add as alias
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {(error || notice) && (
        <p
          role="status"
          className={error ? "mt-3 text-meta text-danger" : "mt-3 text-meta text-ink-secondary"}
        >
          {error ?? notice}
        </p>
      )}
    </div>
  );
}
