import type { Metadata } from "next";
import { Pagination } from "@/components/newsroom/pagination";
import { EmptyState } from "@/components/newsroom/states";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { listSyncRuns } from "@/server/data/sources";
import { SettingsSection } from "../section";

export const metadata: Metadata = { title: "Sync history" };

const PAGE_SIZE = 20;
const STATUS = {
  running: { label: "Running", tone: "text-ink-secondary" },
  succeeded: { label: "Succeeded", tone: "text-ink" },
  partial: { label: "Partial", tone: "text-warning" },
  failed: { label: "Failed", tone: "text-danger" },
  abandoned: { label: "Interrupted", tone: "text-warning" },
} as const;
const TRIGGER = { manual: "Manual", cron: "Scheduled", cli: "Command line" } as const;

function duration(start: Date, end: Date | null) {
  if (!end) return "";
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default async function SyncHistoryPage({
  params,
  searchParams,
}: PageProps<"/n/[newsroom]/settings/sync">) {
  const newsroom = await requireNewsroom((await params).newsroom);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const runs = await listSyncRuns(getDb(), newsroom, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <SettingsSection
      title="Sync history"
      description={`Times are shown in ${newsroom.timezone.replace(/_/g, " ")}.`}
    >
      {runs.items.length === 0 ? (
        <EmptyState title="No syncs yet" className="py-10">
          Connect a folder and press Sync now, or wait for the scheduled sync.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabular w-full text-meta">
            <thead>
              <tr className="border-b border-separator-strong text-left text-ink-secondary">
                {[
                  "Started",
                  "Trigger",
                  "Status",
                  "Found",
                  "Imported",
                  "Updated",
                  "Unchanged",
                  "Failed",
                  "Duration",
                ].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {runs.items.map((run) => (
              <tbody key={run.id} className="border-b border-separator">
                <tr>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {formatDateTime(run.startedAt, newsroom.timezone)}
                  </td>
                  <td className="py-2.5 pr-4 text-ink-secondary">{TRIGGER[run.trigger]}</td>
                  <td className={cn("py-2.5 pr-4 font-medium", STATUS[run.status].tone)}>
                    {STATUS[run.status].label}
                  </td>
                  <td className="py-2.5 pr-4">{run.filesDiscovered}</td>
                  <td className="py-2.5 pr-4">{run.filesImported}</td>
                  <td className="py-2.5 pr-4">{run.filesUpdated}</td>
                  <td className="py-2.5 pr-4 text-ink-secondary">{run.filesSkipped}</td>
                  <td className={cn("py-2.5 pr-4", run.filesFailed && "text-danger")}>
                    {run.filesFailed}
                  </td>
                  <td className="py-2.5 pr-4 text-ink-secondary">
                    {duration(run.startedAt, run.finishedAt)}
                  </td>
                </tr>
                {(run.errorMessage || run.errors.length > 0 || run.filesMissing > 0) && (
                  <tr>
                    <td colSpan={9} className="pb-3">
                      <div className="space-y-1 rounded-(--radius-control) bg-surface px-3 py-2 font-sans text-ink-secondary">
                        {run.errorMessage && <p>{run.errorMessage}</p>}
                        {run.filesMissing > 0 && (
                          <p>
                            {run.filesMissing} previously imported file(s) are no longer in the
                            folder. Their briefings are kept.
                          </p>
                        )}
                        {run.errors.map((e) => (
                          <p key={e.id}>
                            <span className="font-medium text-ink">{e.fileName ?? "Folder"}</span> (
                            {e.stage}): {e.message}
                          </p>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
        </div>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={runs.total}
        hrefFor={(p) => `/n/${newsroom.slug}/settings/sync${p > 1 ? `?page=${p}` : ""}`}
      />
    </SettingsSection>
  );
}
