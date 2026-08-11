/** The active wedding is scoped to this browser tab/session. Explicit sign-out
 * clears it so the next sign-in can choose again when several are available. */
export const ACTIVE_WEDDING_KEY = "union.activeWeddingId";
export const INVITED_WEDDING_KEY = "union.invitedWeddingId";

/** Remember the wedding encoded in an emailed authentication link before the
 * browser leaves Union for Supabase's verification endpoint. This survives
 * Supabase falling back to the configured Site URL when a path-specific
 * redirect has not been allow-listed. */
export function rememberInvitedWedding(weddingId: string): void {
  try {
    window.sessionStorage.setItem(INVITED_WEDDING_KEY, weddingId);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

export function clearActiveWedding(): void {
  try {
    window.sessionStorage.removeItem(ACTIVE_WEDDING_KEY);
    window.sessionStorage.removeItem(INVITED_WEDDING_KEY);
    // Remove the old persistent preference left by earlier deployments.
    window.localStorage.removeItem(ACTIVE_WEDDING_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
