import { TopBar } from "@/components/newsroom/top-bar";
import { canEditNewsroom, requireNewsroom } from "@/server/auth";

export default async function NewsroomLayout({ children, params }: LayoutProps<"/n/[newsroom]">) {
  const { newsroom: slug } = await params;
  const [newsroom, canEdit] = await Promise.all([requireNewsroom(slug), canEditNewsroom(slug)]);
  return (
    <>
      <TopBar newsroom={newsroom} canEdit={canEdit} />
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-8 sm:pt-14">{children}</main>
    </>
  );
}
