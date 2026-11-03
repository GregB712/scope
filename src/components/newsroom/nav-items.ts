export type NavItem = { href: string; label: string; exact?: boolean };

/** Primary navigation. Specific labels ("Today", "Archive") rather than "Home" (apple-design). */
export function navItems(newsroom: string): NavItem[] {
  const base = `/n/${newsroom}`;
  return [
    { href: base, label: "Today", exact: true },
    { href: `${base}/reports`, label: "Archive" },
    { href: `${base}/topics`, label: "Topics" },
    { href: `${base}/search`, label: "Search" },
    { href: `${base}/settings`, label: "Settings" },
  ];
}
