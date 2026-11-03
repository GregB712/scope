import type { ReactNode } from "react";

/** Centered frame for Clerk's sign-in and sign-up components. */
export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center px-4 py-16">{children}</main>;
}
