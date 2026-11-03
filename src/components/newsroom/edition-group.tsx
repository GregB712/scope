import type { ReportListItem } from "@/server/data/reports";
import { formatLongDate, plural } from "@/lib/format";
import { ReportCard } from "./report-card";

/** Groups consecutive editions of the same day under one date heading. */
export function groupByDay(items: ReportListItem[]): { date: string; items: ReportListItem[] }[] {
  const groups: { date: string; items: ReportListItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.date === item.reportDate) last.items.push(item);
    else groups.push({ date: item.reportDate, items: [item] });
  }
  return groups;
}

export function EditionList({
  newsroom,
  items,
  view = "list",
}: {
  newsroom: string;
  items: ReportListItem[];
  view?: "list" | "grid";
}) {
  const groups = groupByDay(items);
  if (view === "grid") {
    return (
      <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="border-t border-separator">
            <ReportCard newsroom={newsroom} report={item} variant="tile" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="hairline-list">
      {groups.map((group) =>
        group.items.length === 1 ? (
          <ReportCard key={group.date} newsroom={newsroom} report={group.items[0]!} />
        ) : (
          <section key={group.date} aria-label={formatLongDate(group.date)} className="py-2">
            <p className="pt-3 text-meta text-ink-secondary">
              {formatLongDate(group.date)}: {plural(group.items.length, "edition")}
            </p>
            <div className="hairline-list">
              {group.items.map((item) => (
                <ReportCard key={item.id} newsroom={newsroom} report={item} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
