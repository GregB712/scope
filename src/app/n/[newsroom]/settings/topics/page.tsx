import type { Metadata } from "next";
import { TopicEditor, UnmappedCategories } from "@/components/settings/topic-editor";
import { requireEditableNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { listTopics, listUnmappedCategories } from "@/server/data/topics";
import { SettingsSection } from "../section";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicSettingsPage({
  params,
}: PageProps<"/n/[newsroom]/settings/topics">) {
  const newsroom = await requireEditableNewsroom((await params).newsroom);
  const db = getDb();
  const [topics, unmapped] = await Promise.all([
    listTopics(db, newsroom),
    listUnmappedCategories(db, newsroom),
  ]);
  const plain = topics.map(({ id, name, aliases, description }) => ({
    id,
    name,
    aliases,
    description,
  }));

  return (
    <>
      <SettingsSection
        title="Topics"
        description={
          <>
            A story belongs to a topic when its category matches the topic&apos;s name, one of its
            aliases, or one half of an “X & Y” name. Compound categories such as “Markets /
            Geopolitics” count for both.
          </>
        }
      >
        <TopicEditor slug={newsroom.slug} topics={plain} />
      </SettingsSection>
      <SettingsSection
        title="Unmapped categories"
        description="Categories your automation wrote that match no topic yet. Add them as topics, or as aliases of existing ones."
      >
        <UnmappedCategories slug={newsroom.slug} phrases={unmapped} topics={plain} />
      </SettingsSection>
    </>
  );
}
