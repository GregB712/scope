import type { Metadata } from "next";
import Link from "next/link";
import { CreateNewsroomForm } from "@/components/onboarding/create-newsroom-form";
import { DEFAULT_TOPICS } from "@/core/topics/defaults";
import { getMyNewsrooms } from "@/server/auth";

export const metadata: Metadata = { title: "Create your newsroom" };

export default async function OnboardingPage() {
  const existing = await getMyNewsrooms();
  return (
    <main className="mx-auto max-w-xl px-6 py-16 sm:py-24">
      <p className="font-serif text-[1.375rem] font-semibold">Scope</p>
      <p className="mt-10 text-meta text-ink-tertiary">Step 1 of 4</p>
      <h1 className="mt-1 font-serif text-display font-semibold">Create your newsroom</h1>
      <p className="mt-3 text-ui text-ink-secondary">
        A newsroom collects the briefings from one research automation. Next you will connect its
        Google Drive folder.
      </p>
      <div className="mt-10">
        <CreateNewsroomForm
          suggestedTopics={DEFAULT_TOPICS.map((t) => t.name)}
          timeZones={Intl.supportedValuesOf("timeZone")}
        />
      </div>
      {existing.length > 0 && (
        <p className="mt-10 text-meta text-ink-secondary">
          Or return to{" "}
          <Link href={`/n/${existing[0]!.slug}`} className="text-signal">
            {existing[0]!.name}
          </Link>
          .
        </p>
      )}
    </main>
  );
}
