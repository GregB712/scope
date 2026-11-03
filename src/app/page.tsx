import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/server/db/client";
import { listOwnedNewsrooms } from "@/server/data/newsroom-access";

/** Signed in: go to your newsroom (or set one up). Signed out: a short introduction. */
export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    const [first] = await listOwnedNewsrooms(getDb(), userId);
    redirect(first ? `/n/${first.slug}` : "/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-24">
      <p className="font-serif text-[1.375rem] font-semibold">Scope</p>
      <h1 className="mt-10 font-serif text-display font-semibold text-balance">
        Your daily intelligence briefings, set for reading.
      </h1>
      <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ink-secondary">
        Scope imports the Markdown dossiers your research automation saves to Google Drive, and
        turns them into a searchable newsroom: today&apos;s briefing first, every story by topic,
        and the whole archive a search away. Read-only, and yours.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
          Create your newsroom
        </Link>
        <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
