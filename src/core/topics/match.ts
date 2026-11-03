/**
 * Deterministic matching of free-text categories and headings to configured topics.
 * See docs/architecture.md, section 6 step 8.
 */

export type TopicRef = { id: string; name: string; aliases: readonly string[] };

/** Lowercase, `&` as "and", punctuation removed, whitespace collapsed. */
export function normalizeTopicText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Splits a compound category such as "Markets / Geopolitics" into its parts. */
export function splitCategory(raw: string): string[] {
  return raw
    .split(/\s*(?:\/|,|;|\||·)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** All normalized phrases that identify a topic: name, aliases, and parts of an "X & Y" name. */
function topicKeys(topic: TopicRef): Set<string> {
  const keys = new Set<string>();
  const add = (value: string) => {
    const key = normalizeTopicText(value);
    if (key) keys.add(key);
  };
  add(topic.name);
  topic.aliases.forEach(add);
  topic.name.split(/\s+(?:&|and)\s+/i).forEach(add);
  return keys;
}

export function createTopicMatcher(topics: readonly TopicRef[]) {
  const index = new Map<string, string>();
  // Earlier topics win when two share a key, which keeps results stable.
  for (const topic of topics) {
    for (const key of topicKeys(topic)) if (!index.has(key)) index.set(key, topic.id);
  }

  /** Topic for a single phrase, ignoring a leading section number such as "3.2". */
  const matchPhrase = (phrase: string): string | null => {
    const cleaned = normalizeTopicText(phrase.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, ""));
    return index.get(cleaned) ?? null;
  };

  return {
    matchPhrase,
    /** Topic IDs for a compound category, plus the parts that matched nothing. */
    matchCategory(raw: string): { topicIds: string[]; unmatched: string[] } {
      const topicIds: string[] = [];
      const unmatched: string[] = [];
      for (const part of splitCategory(raw)) {
        const id = matchPhrase(part);
        if (id) {
          if (!topicIds.includes(id)) topicIds.push(id);
        } else {
          unmatched.push(part);
        }
      }
      return { topicIds, unmatched };
    },
  };
}

export type TopicMatcher = ReturnType<typeof createTopicMatcher>;
