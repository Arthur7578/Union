/** The active wedding is scoped to this browser tab/session. Explicit sign-out
 * clears it so the next sign-in can choose again when several are available. */
export const ACTIVE_WEDDING_KEY = "union.activeWeddingId";

export function clearActiveWedding(): void {
  try {
    window.sessionStorage.removeItem(ACTIVE_WEDDING_KEY);
    // Remove the old persistent preference left by earlier deployments.
    window.localStorage.removeItem(ACTIVE_WEDDING_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
