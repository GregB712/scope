"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { connectFolderAction, previewFolderAction } from "@/server/actions/sources";

type Provider = "google_drive" | "filesystem";

/**
 * Paste a folder link, check what Scope can see, then connect. Checking first
 * shows the folder name and file count so a wrong link is obvious before saving.
 */
export function FolderBinding({
  slug,
  allowFilesystem,
  currentFolder,
  onConnected,
}: {
  slug: string;
  allowFilesystem: boolean;
  currentFolder?: string | null;
  onConnected?: (source: { sourceId: string; name: string; fileCount: number }) => void;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("google_drive");
  const [folder, setFolder] = useState("");
  const [preview, setPreview] = useState<{ name: string; fileCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const check = () =>
    startTransition(async () => {
      setError(null);
      setPreview(null);
      const result = await previewFolderAction(slug, { provider, folder });
      if (result.ok) setPreview(result.data);
      else setError(result.error);
    });

  const connect = () =>
    startTransition(async () => {
      setError(null);
      const result = await connectFolderAction(slug, { provider, folder });
      if (!result.ok) return setError(result.error);
      setPreview(null);
      setFolder("");
      router.refresh();
      onConnected?.(result.data);
    });

  return (
    <div className="max-w-xl space-y-4">
      {allowFilesystem && (
        <div className="space-y-1.5">
          <Label htmlFor="provider">Source</Label>
          <Select
            id="provider"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as Provider);
              setPreview(null);
            }}
          >
            <option value="google_drive">Google Drive folder</option>
            <option value="filesystem">Local folder (development only)</option>
          </Select>
        </div>
      )}
      <form
        className="space-y-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <Label htmlFor="folder">
          {provider === "google_drive" ? "Folder link or ID" : "Path inside FILESYSTEM_SOURCE_ROOT"}
        </Label>
        <div className="flex gap-2">
          <Input
            id="folder"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value);
              setPreview(null);
            }}
            placeholder={
              provider === "google_drive"
                ? "https://drive.google.com/drive/folders/…"
                : "Leave empty for the root"
            }
            aria-invalid={!!error}
            required={provider === "google_drive"}
          />
          <Button type="submit" disabled={pending}>
            {pending && !preview ? "Checking…" : "Check"}
          </Button>
        </div>
        {currentFolder && (
          <p className="text-meta text-ink-tertiary">
            Currently connected: {currentFolder}. Connecting a new folder replaces it.
          </p>
        )}
      </form>

      {preview && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-control) bg-surface px-4 py-3">
          <p className="text-ui">
            <span className="font-medium">{preview.name}</span>
            <span className="text-ink-secondary">
              {" "}
              contains {preview.fileCount} Markdown {preview.fileCount === 1 ? "file" : "files"}.
            </span>
          </p>
          <Button variant="primary" onClick={connect} disabled={pending}>
            {pending ? "Connecting…" : "Connect folder"}
          </Button>
        </div>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}
