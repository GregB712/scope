# Google Drive setup (read-only service account)

Scope reads your reports through a Google Cloud **service account**: a robot Google identity that can only see folders you explicitly share with it. You share your report folder with it as **Viewer**, so it can read but never change anything. Scope also requests only the `drive.readonly` scope.

Time needed: about 10 minutes. No billing account is required.

## 1. Create a Google Cloud project

1. Open <https://console.cloud.google.com/>.
2. Click the project picker in the top bar, then **New project**.
3. Name it, for example `scope-newsroom`, and click **Create**.
4. Make sure the new project is selected in the top bar before continuing.

## 2. Enable the Google Drive API

1. Go to **APIs & Services > Library** (<https://console.cloud.google.com/apis/library>).
2. Search for **Google Drive API**, open it, and click **Enable**.

## 3. Create the service account

1. Go to **IAM & Admin > Service Accounts** (<https://console.cloud.google.com/iam-admin/serviceaccounts>).
2. Click **Create service account**.
3. Name: `scope-drive-reader`. Click **Create and continue**.
4. **Skip** the optional "Grant this service account access to project" step. It needs no project roles: its Drive access comes only from folder sharing. Click **Done**.
5. Copy the service account's email address. It looks like `scope-drive-reader@<project-id>.iam.gserviceaccount.com`.

## 4. Create a JSON key

1. Click the service account, open the **Keys** tab.
2. **Add key > Create new key > JSON > Create**. A `.json` file downloads.
3. Treat this file like a password. Do not commit it, email it, or paste it into chats.

> If key creation is blocked with an organization-policy error (`iam.disableServiceAccountKeyCreation` or `iam.managed.disableServiceAccountKeyCreation`), your account belongs to a Google Workspace organization that forbids keys. Ask the admin for an exception for this project, or use a personal Google account for the Cloud project. Personal accounts have no organization policies.

## 5. Share your report folder with the service account

1. In Google Drive, right-click your report **root folder** (the one containing the year folders) and choose **Share**.
2. Paste the service-account email from step 3.
3. Set the role to **Viewer**.
4. Untick **Notify people** (the robot has no inbox) and click **Share**.

Subfolders and files the automation creates later inside this folder inherit the share automatically.

## 6. Give the key to Scope

Scope reads the key from one environment variable, `GOOGLE_SERVICE_ACCOUNT_KEY`, containing the **base64-encoded** JSON file (one line, no newlines to escape).

Encode it:

```bash
# Linux / WSL
base64 -w0 path/to/key.json

# macOS
base64 -i path/to/key.json | tr -d '\n'
```

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json"))
```

Put the output in `.env.local` (local) and in your Vercel project's environment variables (production):

```
GOOGLE_SERVICE_ACCOUNT_KEY=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Ii...
```

## 7. Find your root folder ID

Open the folder in Drive. The ID is the last part of the URL:

```
https://drive.google.com/drive/folders/<THIS-IS-THE-FOLDER-ID>
```

You paste either the full URL or the ID into Scope during onboarding (or later in **Settings > Google Drive**). Scope verifies access and shows the folder name and the number of Markdown files it found before saving.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "The folder was not found, or is not shared with the service account" | The folder is not shared with the service-account email, or the ID is wrong. Re-check step 5 and the URL. |
| "Google Drive API has not been used in project ... or it is disabled" | Step 2 was done in a different project. Enable the API in the project that owns the service account. |
| `invalid_grant` / `Invalid JWT Signature` | The key was deleted or rotated in Google Cloud. Create a new key (step 4) and update the variable. |
| Files found: 0 | Reports must be `.md` files (MIME type `text/markdown` or a `.md` name) somewhere below the shared folder. |
| "This folder is owned by a different account" | Scope only binds a folder whose Drive owner email matches one of your verified sign-in emails. Sign in with the account that owns the folder, or add that email to your account. |
