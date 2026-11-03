import { TopBar } from "@/components/newsroom/top-bar";
import { requireNewsroom } from "@/server/auth";

export default async function NewsroomLayout({ children, params }: LayoutProps<"/n/[newsroom]">) {
  const newsroom = await requireNewsroom((await params).newsroom);
  return (
    <>
      <TopBar newsroom={newsroom} />
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-8 sm:pt-14">{children}</main>
    </>
  );
}
