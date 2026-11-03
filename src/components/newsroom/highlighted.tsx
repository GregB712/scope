import { splitHighlights } from "@/core/highlight";

/** Renders a search snippet; matches are wrapped in <mark>, everything is plain text. */
export function Highlighted({ snippet }: { snippet: string }) {
  return (
    <>
      {splitHighlights(snippet).map((part, i) =>
        part.highlighted ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
      )}
    </>
  );
}
