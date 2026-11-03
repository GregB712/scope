import Link from "next/link";
import { EmptyState } from "@/components/newsroom/states";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      action={
        <Link href="/" className="text-ui text-signal">
          Go to your newsroom
        </Link>
      }
    >
      This page does not exist, or it belongs to a newsroom you do not have access to.
    </EmptyState>
  );
}
