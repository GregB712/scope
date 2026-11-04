import type { Metadata } from "next";
import Link from "next/link";
import { DateLabel } from "@/components/newsroom/date-label";
import { Notice } from "@/components/newsroom/states";
import { CopyButton } from "@/components/settings/copy-button";
import { FolderBinding } from "@/components/settings/folder-binding";
import { ReprocessButton } from "@/components/settings/reprocess-button";
import { SourceToggle } from "@/components/settings/source-toggle";
import { SyncNowButton } from "@/components/settings/sync-now-button";
import { syncEnv } from "@/env";
import { requireEditableNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { getLatestSyncRun, listSources } from "@/server/data/sources";
import { googleSetupStatus } from "@/server/sources/service-account";
import { SettingsSection } from "../section";

export const metadata: Metadata = { title: "Google Drive" };

const PROVIDER_LABEL = { google_drive: "Google Drive", filesystem: "Local folder" } as const;

export default async function SourceSettingsPage({
  params,
}: PageProps<"/n/[newsroom]/settings/source">) {
  const newsroom = await requireEditableNewsroom((await params).newsroom);
  const db = getDb();
  const [sources, lastRun] = await Promise.all([
    listSources(db, newsroom),
    getLatestSyncRun(db, newsroom),
  ]);
  const google = googleSetupStatus();
  const allowFilesystem = syncEnv().ENABLE_FILESYSTEM_SOURCE;
  const drive = sources.find((s) => s.provider === "google_drive");

  return (
    <>
      <SettingsSection
        title="Google Drive"
        description="Scope reads the Markdown reports in one Drive folder and its sub-folders. It never changes, moves or deletes anything in Drive."
      >
        {google.state === "missing" && (
          <Notice tone="warning">
            Google Drive access is not configured on this server. Set GOOGLE_SERVICE_ACCOUNT_KEY as
            described in <span className="font-mono">docs/google-drive-setup.md</span>.
          </Notice>
        )}
        {google.state === "invalid" && <Notice tone="warning">{google.message}</Notice>}
        {google.state === "ready" && (
          <div className="mb-8 max-w-xl space-y-2">
            <p className="text-ui">
              1. In Google Drive, share your report folder with this address as{" "}
              <strong className="font-medium">Viewer</strong>:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-(--radius-control) bg-surface px-3 py-1.5 font-mono text-meta break-all">
                {google.email}
              </code>
              <CopyButton value={google.email} />
            </div>
            <p className="pt-2 text-ui">
              2. Paste the folder&apos;s link below, check it, and connect.
            </p>
          </div>
        )}
        {(google.state === "ready" || allowFilesystem) && (
          <FolderBinding
            slug={newsroom.slug}
            allowFilesystem={allowFilesystem}
            currentFolder={drive?.rootName}
          />
        )}
      </SettingsSection>

      {sources.length > 0 && (
        <SettingsSection
          title="Synchronization"
          description="New and changed reports are imported on a schedule. You can also sync now."
        >
          <ul className="space-y-8">
            {sources.map((source) => (
              <li key={source.id} className="max-w-xl space-y-4">
                <div>
                  <p className="text-ui font-medium">{source.rootName ?? source.rootRef}</p>
                  <p className="text-meta text-ink-tertiary">
                    {PROVIDER_LABEL[source.provider]}
                    {source.lastSuccessAt && (
                      <>
                        , last successful sync{" "}
                        <DateLabel instant={source.lastSuccessAt} style="relative" />
                      </>
                    )}
                  </p>
                </div>
                <SourceToggle slug={newsroom.slug} sourceId={source.id} enabled={source.enabled} />
                <SyncNowButton slug={newsroom.slug} sourceId={source.id} />
              </li>
            ))}
          </ul>
          {lastRun && (
            <p className="mt-6 text-meta text-ink-secondary">
              <Link href={`/n/${newsroom.slug}/settings/sync`} className="text-signal">
                See sync history
              </Link>
            </p>
          )}
        </SettingsSection>
      )}

      <SettingsSection
        title="Re-process"
        description="Re-reads every stored briefing with the current parser and topics. Useful after upgrading Scope. Your Drive folder is not contacted."
      >
        <ReprocessButton slug={newsroom.slug} />
      </SettingsSection>
    </>
  );
}
