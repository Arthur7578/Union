export const ACTIVE_GUEST_IDENTITY_KEY = "union.activeGuestIdentity";

export interface ActiveGuestIdentity {
  userId: string;
  guestId: string;
  guestName: string;
}

export function readStoredActiveGuestIdentity(): ActiveGuestIdentity | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_GUEST_IDENTITY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ActiveGuestIdentity>;
    if (
      typeof value.userId !== "string" ||
      typeof value.guestId !== "string" ||
      typeof value.guestName !== "string"
    ) {
      return null;
    }
    return value as ActiveGuestIdentity;
  } catch {
    return null;
  }
}

export function readActiveGuestIdentity(
  userId: string,
): ActiveGuestIdentity | null {
  const value = readStoredActiveGuestIdentity();
  return value?.userId === userId ? value : null;
}

export function writeActiveGuestIdentity(
  identity: ActiveGuestIdentity,
): void {
  try {
    window.localStorage.setItem(
      ACTIVE_GUEST_IDENTITY_KEY,
      JSON.stringify(identity),
    );
  } catch {
    // Guest switching still works for this page load when storage is blocked.
  }
}

export function clearActiveGuestIdentity(): void {
  try {
    window.localStorage.removeItem(ACTIVE_GUEST_IDENTITY_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
