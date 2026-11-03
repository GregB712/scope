/**
 * Accepts a Drive folder ID or any common folder URL and returns the ID.
 * Pure: shared by the onboarding form and the server.
 */
export function parseDriveFolderRef(input: string): string | null {
  const value = input.trim();
  const fromUrl =
    /\/folders\/([A-Za-z0-9_-]+)/.exec(value)?.[1] ?? /[?&]id=([A-Za-z0-9_-]+)/.exec(value)?.[1];
  const id = fromUrl ?? value;
  return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : null;
}
