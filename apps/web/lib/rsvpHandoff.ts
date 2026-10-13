/**
 * "Respond to the invitation" means answering it: the guest who chooses it
 * on the faire-part (or reaches their invitation through the group link)
 * goes straight into the RSVP, not to the hub with a second button to press.
 *
 * A one-shot flag for this tab, set where the guest chose to respond and
 * taken by the hub when it opens. Taking it clears it, so a reload or a
 * later visit lands on the hub as usual.
 */

const key = (token: string) => `union.rsvpHandoff.${token}`;

export function markRsvpHandoff(token: string): void {
  try {
    window.sessionStorage.setItem(key(token), "1");
  } catch {
    // Storage blocked: the guest lands on the hub and its reply button.
  }
}

/** Whether the guest has just chosen to respond; clears the flag. */
export function takeRsvpHandoff(token: string): boolean {
  try {
    const set = window.sessionStorage.getItem(key(token)) === "1";
    if (set) window.sessionStorage.removeItem(key(token));
    return set;
  } catch {
    return false;
  }
}
