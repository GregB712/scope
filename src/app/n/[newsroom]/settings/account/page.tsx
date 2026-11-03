import { UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account" };

/** Clerk's account management: profile, email addresses, security, sessions. */
export default function AccountPage() {
  return <UserProfile routing="hash" />;
}
