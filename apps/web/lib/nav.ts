/** The five tabs in the app shell's nav (sidebar on desktop, tab bar on mobile). */
export type NavKey = "today" | "vendors" | "union" | "guests" | "plan";

/**
 * The nav tab a route belongs to, or null when it belongs to none.
 *
 * Null is the point: the account area sits outside the five tabs, so nothing
 * under it should light one up. Falling back to "today" for unmatched routes
 * highlighted Today across all of `/account`.
 */
export function activeNavKey(path: string): NavKey | null {
  if (path.startsWith("/vendors/search")) return "union";
  if (path.startsWith("/vendors")) return "vendors";
  if (path.startsWith("/guests")) return "guests";
  if (path.startsWith("/plan")) return "plan";
  if (path.startsWith("/today")) return "today";
  return null;
}
