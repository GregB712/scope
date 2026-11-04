import { PageHeader } from "@/components/newsroom/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireEditableNewsroom } from "@/server/auth";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/n/[newsroom]/settings">) {
  const newsroom = await requireEditableNewsroom((await params).newsroom);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <SettingsNav slug={newsroom.slug} />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
