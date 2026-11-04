import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "@/components/newsroom/states";
import { CopyButton } from "@/components/settings/copy-button";
import { FolderBinding } from "@/components/settings/folder-binding";
import { SyncNowButton } from "@/components/settings/sync-now-button";
import { buttonVariants } from "@/components/ui/button";
import { syncEnv } from "@/env";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireEditableNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { getNewsroomStats } from "@/server/data/reports";
import { listSources } from "@/server/data/sources";
import { listTopics } from "@/server/data/topics";
import { googleSetupStatus } from "@/server/sources/service-account";

export const metadata: Metadata = { title: "Set up your newsroom" };

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4 border-t border-separator py-8">
      <span
        aria-hidden
        className={cn(
          "grid size-7 place-items-center rounded-full text-meta font-semibold",
          done ? "bg-signal text-signal-ink" : "bg-surface text-ink-secondary",
        )}
      >
        {done ? <Check className="size-4" /> : number}
      </span>
      <div>
        <h2 className="text-headline font-semibold">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        <div className="mt-3 text-ui text-ink-secondary">{children}</div>
      </div>
    </li>
  );
}

export default async function WelcomePage({ params }: PageProps<"/n/[newsroom]/welcome">) {
  const newsroom = await requireEditableNewsroom((await params).newsroom);
  const db = getDb();
  const [sources, topics, stats] = await Promise.all([
    listSources(db, newsroom),
    listTopics(db, newsroom),
    getNewsroomStats(db, newsroom),
  ]);
  const google = googleSetupStatus();
  const source = sources[0];
  const base = `/n/${newsroom.slug}`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-display font-semibold">Set up {newsroom.name}</h1>
      <p className="mt-3 text-ui text-ink-secondary">
        Three short steps, then your briefings are ready to read.
      </p>

      <ol className="mt-10">
        <Step number={2} title="Connect your Google Drive folder" done={!!source}>
          {source ? (
            <p>
              Connected to <span className="font-medium text-ink">{source.rootName}</span>.
            </p>
          ) : (
            <div className="space-y-5">
              {google.state === "ready" ? (
                <>
                  <p>Share the folder your automation writes to with this address, as Viewer:</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-(--radius-control) bg-surface px-3 py-1.5 font-mono text-meta break-all text-ink">
                      {google.email}
                    </code>
                    <CopyButton value={google.email} />
                  </div>
                  <p>Then paste the folder link:</p>
                </>
              ) : (
                <Notice tone="warning">
                  Google Drive access is not configured on this server yet
                  (GOOGLE_SERVICE_ACCOUNT_KEY). See docs/google-drive-setup.md.
                </Notice>
              )}
              {(google.state === "ready" || syncEnv().ENABLE_FILESYSTEM_SOURCE) && (
                <FolderBinding
                  slug={newsroom.slug}
                  allowFilesystem={syncEnv().ENABLE_FILESYSTEM_SOURCE}
                />
              )}
            </div>
          )}
        </Step>

        <Step number={3} title="Choose your topics" done={topics.length > 0}>
          <p>
            {topics.length
              ? `${topics.length} topics: ${topics.map((t) => t.name).join(", ")}.`
              : "No topics yet."}{" "}
            Stories are grouped by matching their category to a topic.
          </p>
          <Link href={`${base}/settings/topics`} className="mt-3 inline-block text-signal">
            {topics.length ? "Review topics" : "Add topics"}
          </Link>
        </Step>

        <Step number={4} title="Import your briefings" done={stats.reportCount > 0}>
          {stats.reportCount > 0 ? (
            <p>
              {plural(stats.reportCount, "briefing")} imported. New ones arrive with each scheduled
              sync.
            </p>
          ) : source ? (
            <div className="space-y-3">
              <p>Run the first sync now. Large archives may take a couple of runs.</p>
              <SyncNowButton slug={newsroom.slug} sourceId={source.id} />
            </div>
          ) : (
            <p>Available once a folder is connected.</p>
          )}
        </Step>
      </ol>

      <div className="border-t border-separator pt-8">
        <Link
          href={base}
          className={buttonVariants({ variant: stats.reportCount > 0 ? "primary" : "secondary" })}
        >
          {stats.reportCount > 0 ? "Start reading" : "Skip for now"}
        </Link>
      </div>
    </div>
  );
}
