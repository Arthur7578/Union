/**
 * Which modules a wedding's guest invitation shows.
 *
 * The guest portal is built from four modules — the forms the couple sends,
 * the travel/carpool board, the logistics and stays page, and the FAQ. Not
 * every wedding wants all four: a city hall ceremony with no room blocks and
 * no carpooling has nothing to put behind two of those tabs, and an empty tab
 * reads as a couple who forgot to fill it in.
 *
 * Storage keeps only what the couple has changed, as a jsonb map on
 * `weddings.guest_modules`:
 *
 * ```json
 * { "travel": false, "logistics": false }
 * ```
 *
 * An absent key means the module is **on**. That is deliberate in two
 * directions: every wedding written before this existed holds `{}` and so
 * renders exactly as it did, and a module added to the portal later is on for
 * everyone until somebody turns it off — new modules ship visible rather than
 * silently missing for every existing wedding.
 *
 * The database enforces the same shape (`_guest_modules_valid`), including the
 * rule that the last module can't be turned off. Readers here are permissive
 * anyway — an unknown key, a non-boolean, or a null column resolves to the
 * default rather than throwing, because a malformed row must never blank out a
 * guest's invitation.
 */

/** Every module the guest portal can render, in the order guests see them. */
export const GUEST_MODULE_KEYS = [
  "forms",
  "travel",
  "logistics",
  "faq",
] as const;

export type GuestModuleKey = (typeof GUEST_MODULE_KEYS)[number];

/** Fully resolved state: one explicit boolean per module, no absent keys. */
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
 * Resolves a stored map into one boolean per module.
 *
 * Anything that isn't an explicit `false` for a known key leaves that module
 * on: missing keys, unknown keys, non-boolean values, a null column, or a
 * value that isn't an object at all.
 */
export function resolveGuestModules(stored: unknown): GuestModules {
  const map =
    stored !== null && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  const resolved = {} as GuestModules;
  for (const key of GUEST_MODULE_KEYS) {
    resolved[key] = map[key] !== false;
  }
  return resolved;
}

/** The module keys that are on, in the order guests see them. */
export function enabledGuestModules(stored: unknown): GuestModuleKey[] {
  const resolved = resolveGuestModules(stored);
  return GUEST_MODULE_KEYS.filter((key) => resolved[key]);
}

/**
 * Narrows the full state back down to the "off" decisions worth storing, so a
 * row records what the couple chose rather than a snapshot of today's
 * defaults — which is what lets a later module default to on.
 */
export function toStoredGuestModules(
  modules: GuestModules,
): Partial<Record<GuestModuleKey, boolean>> {
  const stored: Partial<Record<GuestModuleKey, boolean>> = {};
  for (const key of GUEST_MODULE_KEYS) {
    if (!modules[key]) stored[key] = false;
  }
  return stored;
}
