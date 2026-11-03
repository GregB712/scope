import Link from "next/link";
import { cn } from "@/lib/utils";

export function TopicBadge({
  newsroom,
  topic,
  className,
}: {
  newsroom: string;
  topic: { name: string; slug: string };
  className?: string;
}) {
  return (
    <Link
      href={`/n/${newsroom}/topics/${topic.slug}`}
      className={cn(
        "inline-flex max-w-full items-center rounded-full bg-surface px-2.5 py-0.5 text-meta text-ink-secondary transition-colors duration-150",
        "[@media(hover:hover)]:hover:text-ink",
        className,
      )}
    >
      <span className="truncate">{topic.name}</span>
    </Link>
  );
}

export function TopicList({
  newsroom,
  topics,
  max = 3,
}: {
  newsroom: string;
  topics: { name: string; slug: string }[];
  max?: number;
}) {
  if (!topics.length) return null;
  const shown = topics.slice(0, max);
  const hidden = topics.length - shown.length;
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {shown.map((topic) => (
        <li key={topic.slug} className="min-w-0">
          <TopicBadge newsroom={newsroom} topic={topic} />
        </li>
      ))}
      {hidden > 0 && <li className="text-meta text-ink-tertiary">+{hidden}</li>}
    </ul>
  );
}
