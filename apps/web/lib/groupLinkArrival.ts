/**
 * Whether this tab reached an invitation through the wedding's group link
 * rather than the guest's personal link. The group link asks a guest without
 * an email for one when they reply; a personal link only offers it, since the
 * couple hands those out precisely to guests who'd struggle with the group
 * link. Kept for the tab only: it is a reason to ask, not a security check.
 */

const key = (token: string) => `union.groupLinkArrival.${token}`;

export function markGroupLinkArrival(token: string): void {
  try {
    window.sessionStorage.setItem(key(token), "1");
  } catch {
    // Storage blocked: the email is then simply optional.
  }
}

export function arrivedThroughGroupLink(token: string): boolean {
  try {
    return window.sessionStorage.getItem(key(token)) === "1";
  } catch {
    return false;
  }
}
