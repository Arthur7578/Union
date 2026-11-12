/**
 * Which parts of the wedding page a guest sees.
 *
 * The page opens on the faire-part in its envelope and always ends with the
 * reply (and the couple's other forms under it). Between the two, the couple
 * turns parts on or off: their word, the weekend, the venue and getting
 * there, carpooling, the dress code, their questions.
 *
 * Storage keeps only what the couple has changed, as a jsonb map on
 * `weddings.guest_modules`:
 *
 * ```json
 * { "travel": false, "dress": false }
 * ```
 *
 * An absent key means the part takes its default (`GUEST_MODULE_DEFAULTS`):
 * on, except carpooling. A part being on shows nothing by itself: the guest
 * page leaves out a part with nothing written in it.
 *
 * The database enforces the same shape (`_guest_modules_valid`, migration
 * 20261107190000_wedding_page_parts). Every part may be off. Readers here are
 * permissive anyway: an unknown key, a non-boolean, or a null column resolves
 * to the default rather than throwing, because a malformed row must never
 * blank out a guest's invitation.
 */

/** Every part the wedding page can show, in the order guests see them. */
export const GUEST_MODULE_KEYS = [
  "word",
  "weekend",
  "venue",
  "travel",
  "dress",
  "faq",
] as const;

export type GuestModuleKey = (typeof GUEST_MODULE_KEYS)[number];

/** Fully resolved state: one explicit boolean per part, no absent keys. */
export type GuestModules = Record<GuestModuleKey, boolean>;

/** What actually comes back from jsonb: the map, or nothing at all. */
export type StoredGuestModules =
  | Partial<Record<string, boolean>>
  | null
  | undefined;

export function isGuestModuleKey(key: string): key is GuestModuleKey {
  return (GUEST_MODULE_KEYS as readonly string[]).includes(key);
}

/**
 * Whether a part is on when the couple has chosen nothing for it. Every part
 * is, except carpooling: its board still shows sample posts instead of real
 * ones (issue #109), so a couple turns it on knowingly.
 */
export const GUEST_MODULE_DEFAULTS: GuestModules = {
  word: true,
  weekend: true,
  venue: true,
  travel: false,
  dress: true,
  faq: true,
};

/**
 * Resolves a stored map into one boolean per part: the couple's explicit
 * choice where there is one, the part's default otherwise (missing or
 * unknown keys, non-boolean values, a null column, a value that isn't an
 * object at all).
 */
export function resolveGuestModules(stored: unknown): GuestModules {
  const map =
    stored !== null && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  const resolved = {} as GuestModules;
  for (const key of GUEST_MODULE_KEYS) {
    const chosen = map[key];
    resolved[key] = typeof chosen === "boolean" ? chosen : GUEST_MODULE_DEFAULTS[key];
  }
  return resolved;
}

/** The module keys that are on, in the order guests see them. */
export function enabledGuestModules(stored: unknown): GuestModuleKey[] {
  const resolved = resolveGuestModules(stored);
  return GUEST_MODULE_KEYS.filter((key) => resolved[key]);
}

/**
 * Narrows the full state back down to the choices worth storing: the ones
 * that differ from a part's default. A row then records what the couple
 * chose, not a snapshot of today's defaults.
 */
export function toStoredGuestModules(
  modules: GuestModules,
): Partial<Record<GuestModuleKey, boolean>> {
  const stored: Partial<Record<GuestModuleKey, boolean>> = {};
  for (const key of GUEST_MODULE_KEYS) {
    if (modules[key] !== GUEST_MODULE_DEFAULTS[key]) stored[key] = modules[key];
  }
  return stored;
}
