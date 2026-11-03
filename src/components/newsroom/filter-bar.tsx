import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { Select } from "@/components/ui/input";
import type { ArchiveParams } from "@/lib/search-params";
import { toQuery } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { AutoSubmitForm } from "./auto-submit-form";
import { SearchField } from "./search-field";

/** Archive filters, all reflected in the URL so views are shareable and server-rendered. */
export function FilterBar({
  action,
  params,
  topics,
}: {
  action: string;
  params: ArchiveParams;
  topics: { name: string; slug: string }[];
}) {
  const hasFilters = Boolean(
    params.q || params.from || params.to || params.topic || params.minImportance,
  );
  const viewHref = (view: "list" | "grid") =>
    `${action}${toQuery({
      q: params.q,
      month: params.month,
      from: params.month ? undefined : params.from,
      to: params.month ? undefined : params.to,
      topic: params.topic,
      importance: params.minImportance,
      sort: params.sort === "oldest" ? "oldest" : undefined,
      view: view === "grid" ? "grid" : undefined,
    })}`;

  return (
    <AutoSubmitForm action={action} className="space-y-3">
      <SearchField defaultValue={params.q} placeholder="Search titles and content" />
      <div className="flex flex-wrap items-end gap-3">
        {params.month && <input type="hidden" name="month" value={params.month} />}
        {params.view === "grid" && <input type="hidden" name="view" value="grid" />}
        <label className="flex flex-col gap-1">
          <span className="text-meta text-ink-secondary">Topic</span>
          <Select name="topic" defaultValue={params.topic ?? ""} className="h-9 w-48">
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-meta text-ink-secondary">Importance</span>
          <Select
            name="importance"
            defaultValue={params.minImportance?.toString() ?? ""}
            className="h-9 w-36"
          >
            <option value="">Any</option>
            <option value="9">9 and above</option>
            <option value="8">8 and above</option>
            <option value="7">7 and above</option>
          </Select>
        </label>
        {!params.month && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-meta text-ink-secondary">From</span>
              <input
                type="date"
                name="from"
                defaultValue={params.from}
                className="h-9 rounded-(--radius-control) bg-surface px-2 text-ui"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-meta text-ink-secondary">To</span>
              <input
                type="date"
                name="to"
                defaultValue={params.to}
                className="h-9 rounded-(--radius-control) bg-surface px-2 text-ui"
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-meta text-ink-secondary">Order</span>
          <Select name="sort" defaultValue={params.sort} className="h-9 w-36">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </label>
        <button
          type="submit"
          className="pressable h-9 rounded-(--radius-control) bg-surface px-4 text-ui"
        >
          Apply
        </button>
        {hasFilters && (
          <Link href={action} className="h-9 content-center px-1 text-ui text-signal">
            Clear
          </Link>
        )}
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="View">
          {(["list", "grid"] as const).map((view) => {
            const Icon = view === "list" ? List : LayoutGrid;
            return (
              <Link
                key={view}
                href={viewHref(view)}
                aria-label={view === "list" ? "List view" : "Grid view"}
                aria-current={params.view === view ? "true" : undefined}
                className={cn(
                  "grid size-9 place-items-center rounded-(--radius-control) text-ink-tertiary",
                  params.view === view
                    ? "bg-surface text-ink"
                    : "[@media(hover:hover)]:hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </Link>
            );
          })}
        </div>
      </div>
    </AutoSubmitForm>
  );
}
