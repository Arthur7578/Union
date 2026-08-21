/**
 * What a guest may do from their own invitation: add a partner, add children,
 * and how many children at most.
 *
 * There are two levels, and one rule that joins them.
 *
 * The wedding carries the defaults, set on /guests/permissions:
 * `weddings.allow_guests_add_partner`, `allow_guests_add_children`, and
 * `max_children_per_guest` (null = no cap).
 *
 * A guest may carry an override, set on their own detail page:
 * `guests.can_add_partner` / `can_add_kids`, where **null means inherit**.
 * The couple sees that null as "Inherit wedding default" next to "Yes" and
 * "No", so the three-way choice and the two-way column need translating in
 * both directions — that's `overrideToChoice` / `choiceToOverride`.
 *
 * The rule is a coalesce: an explicit override wins, otherwise the wedding
 * default applies. The database is the source of truth for it — every
 * invitation RPC computes
 *
 * ```sql
 * v_can_partner := coalesce(v_guest.can_add_partner, v_wedding.allow_guests_add_partner);
 * v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_children);
 * ```
 *
 * and ships the resolved booleans to the client as `invitation.permissions`.
 * `resolveGuestPermission` and `resolveChildrenRemaining` mirror that plpgsql
 * in TypeScript so the rule is stated once, in a form the test suite can
 * actually run. They are a mirror, not a replacement: nothing here is
 * enforcement — a client that resolves a permission it wasn't granted still
 * gets refused by the RPC.
 */

/** The three-way choice the couple sees on a guest's detail page. */
export type PermissionChoice = "inherit" | "yes" | "no";

/** How an override is stored: null (or an absent column) means inherit. */
export type StoredPermissionOverride = boolean | null | undefined;

/**
 * The coalesce rule, in TypeScript: an explicit per-guest override wins, and
 * anything else — null, an absent column — falls through to the wedding
 * default.
 */
export function resolveGuestPermission(
  override: StoredPermissionOverride,
  weddingDefault: boolean,
): boolean {
  return typeof override === "boolean" ? override : weddingDefault;
}

/** Stored override → the radio the couple sees. */
export function overrideToChoice(
  override: StoredPermissionOverride,
): PermissionChoice {
  if (override == null) return "inherit";
  return override ? "yes" : "no";
}

/** The radio the couple picked → the value to store. Inherit stores null. */
export function choiceToOverride(choice: PermissionChoice): boolean | null {
  if (choice === "inherit") return null;
  return choice === "yes";
}

/**
 * How many more children this guest may still register.
 *
 * Mirrors the `kids_remaining` case in the invitation RPCs: 0 when children
 * aren't allowed at all, null when the wedding sets no cap, and never
 * negative — a guest who already has more children than a cap later lowered
 * to below that reads as 0 rather than as a negative budget.
 */
export function resolveChildrenRemaining({
  canAddChildren,
  cap,
  used,
}: {
  canAddChildren: boolean;
  cap: number | null;
  used: number;
}): number | null {
  if (!canAddChildren) return 0;
  if (cap == null) return null;
  return Math.max(cap - used, 0);
}

/**
 * Whether the invitation should offer "add a partner".
 *
 * A guest may hold at most one partner, so the option disappears once they
 * have one — the permission says they may add a partner, not that they may
 * keep adding them.
 */
export function canAddPartner({
  allowed,
  hasPartner,
}: {
  allowed: boolean;
  hasPartner: boolean;
}): boolean {
  return allowed && !hasPartner;
}

/**
 * Whether the invitation should offer "add a child". Unlike a partner there
 * is no natural limit of one, so the wedding's cap is what closes the option:
 * a null budget is unlimited, and an exhausted one hides it.
 */
export function canAddChildren({
  allowed,
  remaining,
}: {
  allowed: boolean;
  remaining: number | null;
}): boolean {
  return allowed && (remaining === null || remaining > 0);
}

/** The highest cap the couple can set. Higher entries clamp down to it. */
export const MAX_CHILDREN_CAP = 50;

/** Which of the two cap radios is selected on /guests/permissions. */
export type ChildrenCapMode = "unlimited" | "capped";

/**
 * The cap controls as they should first render for a wedding: a stored null
 * is "No cap" with an empty box, and a stored number is "Cap at" with that
 * number already in it.
 */
export function childrenCapFormState(cap: number | null | undefined): {
  mode: ChildrenCapMode;
  input: string;
} {
  if (cap == null) return { mode: "unlimited", input: "" };
  return { mode: "capped", input: String(cap) };
}

/** Why a cap entry was rejected. The copy lives with the form. */
export type ChildrenCapProblem = "not_a_whole_number";

export type ChildrenCapResult =
  | { ok: true; cap: number | null }
  | { ok: false; problem: ChildrenCapProblem };

/**
 * The cap to store for what the couple has on screen.
 *
 * Null — no cap — covers both ways of having none: the "No cap" radio, and
 * children being disallowed outright, where a leftover number would be a cap
 * on something that can't happen. A capped entry has to parse as a
 * non-negative number, and one above `MAX_CHILDREN_CAP` clamps rather than
 * failing: a couple typing 500 means "as many as they like", which the cap
 * ceiling expresses well enough.
 */
export function resolveChildrenCap({
  allowChildren,
  mode,
  input,
}: {
  allowChildren: boolean;
  mode: ChildrenCapMode;
  input: string;
}): ChildrenCapResult {
  if (!allowChildren || mode === "unlimited") return { ok: true, cap: null };

  const parsed = parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, problem: "not_a_whole_number" };
  }
  return { ok: true, cap: Math.min(MAX_CHILDREN_CAP, parsed) };
}

/** The three wedding columns /guests/permissions writes. */
export type GuestPermissionsPatch = {
  allow_guests_add_partner: boolean;
  allow_guests_add_children: boolean;
  max_children_per_guest: number | null;
};

export type GuestPermissionsPatchResult =
  | { ok: true; patch: GuestPermissionsPatch }
  | { ok: false; problem: ChildrenCapProblem };

/**
 * The whole form, resolved into the update to send — or the reason it can't
 * be sent yet. The toggles never fail on their own; only the cap can.
 */
export function buildGuestPermissionsPatch({
  allowPartner,
  allowChildren,
  capMode,
  capInput,
}: {
  allowPartner: boolean;
  allowChildren: boolean;
  capMode: ChildrenCapMode;
  capInput: string;
}): GuestPermissionsPatchResult {
  const cap = resolveChildrenCap({
    allowChildren,
    mode: capMode,
    input: capInput,
  });
  if (!cap.ok) return cap;

  return {
    ok: true,
    patch: {
      allow_guests_add_partner: allowPartner,
      allow_guests_add_children: allowChildren,
      max_children_per_guest: cap.cap,
    },
  };
}
