import { formatDate, formatDayMonth, formatLongDate, formatRelative } from "@/lib/format";

type Props =
  { date: string; style?: "long" | "medium" | "short" } | { instant: Date; style: "relative" };

/** A semantic `<time>` with consistent formatting. */
export function DateLabel(props: Props & { className?: string }) {
  if ("instant" in props) {
    return (
      <time
        dateTime={props.instant.toISOString()}
        title={props.instant.toUTCString()}
        className={props.className}
      >
        {formatRelative(props.instant)}
      </time>
    );
  }
  const text =
    props.style === "long"
      ? formatLongDate(props.date)
      : props.style === "short"
        ? formatDayMonth(props.date)
        : formatDate(props.date);
  return (
    <time dateTime={props.date} className={props.className}>
      {text}
    </time>
  );
}
