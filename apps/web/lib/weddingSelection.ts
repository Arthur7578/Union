/** The active wedding is scoped to this browser tab/session. Explicit sign-out
 * clears it so the next sign-in can choose again when several are available. */
export const ACTIVE_WEDDING_KEY = "union.activeWeddingId";
export const ACTIVE_WEDDING_USER_KEY = "union.activeWeddingUserId";
export const INVITED_WEDDING_KEY = "union.invitedWeddingId";

/** Resolve an ordinary active preference, but never auto-select an emailed
 * invitation. Invitations require an explicit choice on their welcome page. */
export function resolveInitialWeddingId(
  invitedWeddingId: string | null,
  activeWeddingId: string | null,
  availableWeddingIds: string[],
): string | null {
  if (invitedWeddingId) return null;
  if (activeWeddingId && availableWeddingIds.includes(activeWeddingId)) {
    return activeWeddingId;
  }
  return availableWeddingIds.length === 1 ? availableWeddingIds[0] : null;
}

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

/** Store the active wedding together with the account that selected it. A
 * tab can authenticate as another person after following an email link, so a
 * wedding id without an account id is not a safe preference. */
export function rememberActiveWedding(
  weddingId: string,
  userId: string,
): void {
  try {
    window.sessionStorage.setItem(ACTIVE_WEDDING_KEY, weddingId);
    window.sessionStorage.setItem(ACTIVE_WEDDING_USER_KEY, userId);
    // Remove the old persistent preference left by earlier deployments.
    window.localStorage.removeItem(ACTIVE_WEDDING_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

/** Return an active wedding only when it belongs to the current account.
 * Legacy unscoped values are discarded once rather than risk leaking a
 * previous account's selection across an invitation sign-in. */
export function readActiveWedding(userId: string): string | null {
  try {
    const selectedFor = window.sessionStorage.getItem(
      ACTIVE_WEDDING_USER_KEY,
    );
    if (selectedFor !== userId) {
      clearActiveWeddingPreference();
      return null;
    }
    return window.sessionStorage.getItem(ACTIVE_WEDDING_KEY);
  } catch {
    return null;
  }
}

/** Clear only the account-scoped preference. Keep the invitation destination:
 * it is deliberately carried through an account-changing magic-link login. */
export function clearActiveWeddingPreference(): void {
  try {
    window.sessionStorage.removeItem(ACTIVE_WEDDING_KEY);
    window.sessionStorage.removeItem(ACTIVE_WEDDING_USER_KEY);
    // Remove the old persistent preference left by earlier deployments.
    window.localStorage.removeItem(ACTIVE_WEDDING_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

/** Full cleanup for explicit sign-out. */
export function clearActiveWedding(): void {
  clearActiveWeddingPreference();
  try {
    window.sessionStorage.removeItem(INVITED_WEDDING_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
