/**
 * Suggested starting topics, offered (and fully editable) during onboarding.
 * They mirror the research areas of the reference automation. Nothing in the
 * application depends on these names.
 */
export const DEFAULT_TOPICS: ReadonlyArray<{ name: string; aliases: string[] }> = [
  { name: "Programming & Software Engineering", aliases: ["Programming", "Software"] },
  { name: "Cybersecurity", aliases: ["Cyber", "Security"] },
  { name: "Artificial Intelligence", aliases: ["AI"] },
  { name: "Data Science & Machine Learning", aliases: ["ML", "Data Science"] },
  { name: "Stock Market & Global Finance", aliases: ["Finance", "Markets"] },
  { name: "Global Events & Geopolitics", aliases: ["Geopolitics", "World"] },
  { name: "Biomedical & Life Sciences", aliases: ["Biomedical", "Health"] },
  {
    name: "Natural Disasters & Environmental Events",
    aliases: ["Natural Disasters", "Environment"],
  },
];
