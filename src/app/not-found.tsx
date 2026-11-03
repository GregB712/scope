import Link from "next/link";
import { EmptyState } from "@/components/newsroom/states";

export default function NotFound() {
  return (
    <main className="px-5">
      <EmptyState
        title="Not found"
        action={
          <Link href="/" className="text-ui text-signal">
            Go to Scope
          </Link>
        }
      >
        This page does not exist, or you do not have access to it.
      </EmptyState>
    </main>
  );
}
