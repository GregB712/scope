import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getPublishedNewsrooms, isAdmin } from "@/server/auth";

/**
 * Signed in: go to the published newsroom (admins set one up first).
 * Signed out: a short introduction.
 */
export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    const [first] = await getPublishedNewsrooms();
    if (first) redirect(`/n/${first.slug}`);
    if (await isAdmin()) redirect("/onboarding");
    return <NothingPublished />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-24">
      <p className="font-serif text-[1.375rem] font-semibold">Scope</p>
      <h1 className="mt-10 font-serif text-display font-semibold text-balance">
        Daily intelligence briefings, set for reading.
      </h1>
      <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ink-secondary">
        Scope publishes a daily research briefing as a searchable newsroom: today&apos;s briefing
        first, every story by topic, and the whole archive a search away. Create a free account to
        read along.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
          Create an account
        </Link>
        <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
          Sign in
        </Link>
      </div>
      <p className="mt-16 max-w-xl text-meta text-ink-tertiary">
        Want your own newsroom, with your own folder and topics? Scope is open source: clone the
        repository and deploy your copy.
      </p>
    </main>
  );
}

/** A signed-in reader, before the admin has created a newsroom. */
function NothingPublished() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-24">
      <div className="flex items-center justify-between">
        <p className="font-serif text-[1.375rem] font-semibold">Scope</p>
        <div className="grid size-7 place-items-center">
          <UserButton />
        </div>
      </div>
      <h1 className="mt-10 font-serif text-[1.75rem] font-semibold">Nothing published yet</h1>
      <p className="mt-3 text-ui text-ink-secondary">
        You&apos;re subscribed. The first briefing will appear here as soon as it is published.
      </p>
    </main>
  );
}
