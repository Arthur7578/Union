/**
 * Names as the group link compares them: case, accents, spaces, hyphens and
 * punctuation don't count ("Léa-Rose" and "lea rose" are the same). Mirrors
 * public._normalize_guest_first_name in the database.
 */
export function normalizeGuestName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * The guest already on the list that a new guest couldn't be told apart from
 * on the group link: same first name, and a last name that doesn't separate
 * them (missing on either side, or the same). Null when there is none.
 */
export function groupLinkNameClash<G extends { first_name: string; last_name: string | null }>(
  existing: G[],
  firstName: string,
  lastName: string,
): G | null {
  const first = normalizeGuestName(firstName);
  if (!first) return null;
  const last = normalizeGuestName(lastName);
  return (
    existing.find((guest) => {
      if (normalizeGuestName(guest.first_name) !== first) return false;
      const theirs = normalizeGuestName(guest.last_name);
      return !last || !theirs || theirs === last;
    }) ?? null
  );
}
