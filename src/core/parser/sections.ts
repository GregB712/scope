import type { SectionKind } from "./types";

const KIND_PATTERNS: ReadonlyArray<[SectionKind, RegExp]> = [
  [
    "executive_summary",
    /\b(executive summary|summary|key points|tl;?dr|at a glance|headlines|highlights|overview)\b/,
  ],
  ["top_stories", /\b(top|key|main|lead) (stories|news|developments|moves)\b/],
  ["data_snapshot", /\b(snapshot|by the numbers|market data|scoreboard|standings|dashboard)\b/],
  ["radar", /\b(radar|things to follow|worth following|reading list|new releases)\b/],
  ["risk", /\b(risk|risks|monitor|threats?)\b/],
  ["outlook", /\b(what to watch|watch next|outlook|upcoming|coming up|calendar|looking ahead)\b/],
  ["sources", /^(sources|references|bibliography|further reading|links)\b/],
];

/** Classifies a section by its (numbering-free) title. Topic matching happens first, elsewhere. */
export function classifySection(title: string): SectionKind {
  const text = title.toLowerCase();
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}
