export type NavItem = { href: string; label: string; exact?: boolean };

/**
 * Primary navigation. Specific labels ("Today", "Archive") rather than "Home" (apple-design).
 * Settings is listed only for the newsroom's editor.
 */
export function navItems(newsroom: string, canEdit: boolean): NavItem[] {
  const base = `/n/${newsroom}`;
  const items: NavItem[] = [
    { href: base, label: "Today", exact: true },
    { href: `${base}/reports`, label: "Archive" },
    { href: `${base}/topics`, label: "Topics" },
    { href: `${base}/search`, label: "Search" },
  ];
  if (canEdit) items.push({ href: `${base}/settings`, label: "Settings" });
  return items;
}
