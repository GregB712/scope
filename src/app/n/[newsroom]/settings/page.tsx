import type { Metadata } from "next";
import Link from "next/link";
import { NewsroomForm } from "@/components/settings/newsroom-form";
import { getMyNewsrooms, requireEditableNewsroom } from "@/server/auth";
import { SettingsSection } from "./section";

export const metadata: Metadata = { title: "Settings" };

export default async function NewsroomSettingsPage({
  params,
}: PageProps<"/n/[newsroom]/settings">) {
  const newsroom = await requireEditableNewsroom((await params).newsroom);
  const newsrooms = await getMyNewsrooms();
  const timeZones = Intl.supportedValuesOf("timeZone");

  return (
    <>
      <SettingsSection
        title="Newsroom"
        description="How your newsroom is named and which time zone it uses by default."
      >
        <NewsroomForm
          slug={newsroom.slug}
          initial={{
            name: newsroom.name,
            description: newsroom.description,
            timezone: newsroom.timezone,
          }}
          timeZones={
            timeZones.includes(newsroom.timezone) ? timeZones : [newsroom.timezone, ...timeZones]
          }
        />
      </SettingsSection>
      <SettingsSection
        title="Your newsrooms"
        description="Each newsroom has its own source folder, topics and archive."
      >
        <ul className="hairline-list max-w-xl border-y border-separator">
          {newsrooms.map((n) => (
            <li key={n.id} className="flex items-center justify-between py-3">
              <Link
                href={`/n/${n.slug}`}
                className="text-ui [@media(hover:hover)]:hover:text-signal"
              >
                {n.name}
              </Link>
              {n.id === newsroom.id && <span className="text-meta text-ink-tertiary">Current</span>}
            </li>
          ))}
        </ul>
        <Link href="/onboarding" className="mt-4 inline-block text-ui text-signal">
          Create another newsroom
        </Link>
      </SettingsSection>
    </>
  );
}
