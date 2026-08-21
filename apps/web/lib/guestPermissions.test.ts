import { describe, expect, it } from "vitest";
import {
  MAX_CHILDREN_CAP,
  buildGuestPermissionsPatch,
  canAddChildren,
  canAddPartner,
  childrenCapFormState,
  choiceToOverride,
  overrideToChoice,
  resolveChildrenCap,
  resolveChildrenRemaining,
  resolveGuestPermission,
  type PermissionChoice,
} from "@union/shared";

describe("wedding default vs per-guest override", () => {
  // The coalesce in every invitation RPC:
  //   coalesce(guest.can_add_partner, wedding.allow_guests_add_partner)
  // Stated here in TypeScript so the precedence rule is actually run.
  it("falls back to the wedding default when the guest inherits", () => {
    expect(resolveGuestPermission(null, true)).toBe(true);
    expect(resolveGuestPermission(null, false)).toBe(false);
  });

  it("treats a missing column as inherit, not as a denial", () => {
    // A row read before the column existed, or a partial select.
    expect(resolveGuestPermission(undefined, true)).toBe(true);
  });

  it("lets an explicit override beat the wedding default in both directions", () => {
    expect(resolveGuestPermission(true, false)).toBe(true);
    expect(resolveGuestPermission(false, true)).toBe(false);
  });
});

describe("override <-> radio round trip", () => {
  it("shows a stored override as the matching radio", () => {
    expect(overrideToChoice(null)).toBe("inherit");
    expect(overrideToChoice(undefined)).toBe("inherit");
    expect(overrideToChoice(true)).toBe("yes");
    expect(overrideToChoice(false)).toBe("no");
  });

  it("stores inherit as null rather than as false", () => {
    // The distinction is the whole feature: false pins the guest to "no",
    // null keeps following whatever the couple sets on /guests/permissions.
    expect(choiceToOverride("inherit")).toBeNull();
    expect(choiceToOverride("yes")).toBe(true);
    expect(choiceToOverride("no")).toBe(false);
  });

  it("survives a load-then-save with nothing touched", () => {
    for (const stored of [null, true, false] as const) {
      expect(choiceToOverride(overrideToChoice(stored))).toBe(
        stored === null ? null : stored,
      );
    }
  });

  it("survives a save-then-load for every radio", () => {
    const choices: PermissionChoice[] = ["inherit", "yes", "no"];
    for (const choice of choices) {
      expect(overrideToChoice(choiceToOverride(choice))).toBe(choice);
    }
  });
});

describe("children budget", () => {
  it("has no budget to spend when children aren't allowed", () => {
    // 0, not null: null would read as "unlimited" downstream.
    expect(
      resolveChildrenRemaining({ canAddChildren: false, cap: null, used: 0 }),
    ).toBe(0);
    expect(
      resolveChildrenRemaining({ canAddChildren: false, cap: 5, used: 0 }),
    ).toBe(0);
  });

  it("is unlimited when the wedding sets no cap", () => {
    expect(
      resolveChildrenRemaining({ canAddChildren: true, cap: null, used: 12 }),
    ).toBeNull();
  });

  it("counts down from the cap as children are registered", () => {
    expect(
      resolveChildrenRemaining({ canAddChildren: true, cap: 3, used: 0 }),
    ).toBe(3);
    expect(
      resolveChildrenRemaining({ canAddChildren: true, cap: 3, used: 2 }),
    ).toBe(1);
    expect(
      resolveChildrenRemaining({ canAddChildren: true, cap: 3, used: 3 }),
    ).toBe(0);
  });

  it("never goes negative when a cap is lowered below what a guest already has", () => {
    expect(
      resolveChildrenRemaining({ canAddChildren: true, cap: 1, used: 4 }),
    ).toBe(0);
  });

  it("means a cap of 0 allows nobody, even with the toggle on", () => {
    expect(
      resolveChildrenRemaining({ canAddChildren: true, cap: 0, used: 0 }),
    ).toBe(0);
  });
});

describe("what the invitation offers", () => {
  it("offers a partner only to a guest allowed one who hasn't got one", () => {
    expect(canAddPartner({ allowed: true, hasPartner: false })).toBe(true);
    expect(canAddPartner({ allowed: true, hasPartner: true })).toBe(false);
    expect(canAddPartner({ allowed: false, hasPartner: false })).toBe(false);
  });

  it("offers children while budget remains", () => {
    expect(canAddChildren({ allowed: true, remaining: null })).toBe(true);
    expect(canAddChildren({ allowed: true, remaining: 2 })).toBe(true);
  });

  it("stops offering children once the budget is spent", () => {
    expect(canAddChildren({ allowed: true, remaining: 0 })).toBe(false);
  });

  it("never offers children to a guest who isn't allowed them", () => {
    // Even if a stale budget says otherwise.
    expect(canAddChildren({ allowed: false, remaining: null })).toBe(false);
    expect(canAddChildren({ allowed: false, remaining: 3 })).toBe(false);
  });

  it("closes the child option for a guest whose cap is already used up", () => {
    const remaining = resolveChildrenRemaining({
      canAddChildren: true,
      cap: 2,
      used: 2,
    });
    expect(canAddChildren({ allowed: true, remaining })).toBe(false);
  });
});

describe("cap controls, as first rendered", () => {
  it("reads a stored null as 'No cap' with an empty box", () => {
    expect(childrenCapFormState(null)).toEqual({ mode: "unlimited", input: "" });
    expect(childrenCapFormState(undefined)).toEqual({
      mode: "unlimited",
      input: "",
    });
  });

  it("reads a stored number as 'Cap at' with that number in the box", () => {
    expect(childrenCapFormState(3)).toEqual({ mode: "capped", input: "3" });
  });

  it("keeps a stored 0 on the capped radio rather than reading it as no cap", () => {
    // 0 and null are different settings: nobody, versus everybody.
    expect(childrenCapFormState(0)).toEqual({ mode: "capped", input: "0" });
  });
});

describe("resolving the cap to store", () => {
  const capped = (input: string) =>
    resolveChildrenCap({ allowChildren: true, mode: "capped", input });

  it("stores no cap for the 'No cap' radio", () => {
    expect(
      resolveChildrenCap({
        allowChildren: true,
        mode: "unlimited",
        input: "7",
      }),
    ).toEqual({ ok: true, cap: null });
  });

  it("clears a leftover cap when children are switched off", () => {
    // Otherwise the row keeps a cap on something that can't happen, and
    // switching children back on silently restores a forgotten limit.
    expect(
      resolveChildrenCap({ allowChildren: false, mode: "capped", input: "4" }),
    ).toEqual({ ok: true, cap: null });
  });

  it("stores a plain number", () => {
    expect(capped("3")).toEqual({ ok: true, cap: 3 });
  });

  it("accepts 0 as a real cap", () => {
    expect(capped("0")).toEqual({ ok: true, cap: 0 });
  });

  it("clamps anything above the ceiling instead of refusing it", () => {
    expect(capped("500")).toEqual({ ok: true, cap: MAX_CHILDREN_CAP });
    expect(capped(String(MAX_CHILDREN_CAP))).toEqual({
      ok: true,
      cap: MAX_CHILDREN_CAP,
    });
  });

  it("rejects an empty box on the capped radio", () => {
    expect(capped("")).toEqual({ ok: false, problem: "not_a_whole_number" });
    expect(capped("   ")).toEqual({ ok: false, problem: "not_a_whole_number" });
  });

  it("rejects a negative cap", () => {
    expect(capped("-1")).toEqual({ ok: false, problem: "not_a_whole_number" });
  });

  it("rejects text", () => {
    expect(capped("three")).toEqual({
      ok: false,
      problem: "not_a_whole_number",
    });
  });

  it("truncates a decimal rather than rejecting it", () => {
    // A number input only yields a decimal if the browser allows one, and
    // "2 children" is the honest reading of 2.7.
    expect(capped("2.7")).toEqual({ ok: true, cap: 2 });
  });

  it("ignores surrounding whitespace", () => {
    expect(capped(" 5 ")).toEqual({ ok: true, cap: 5 });
  });
});

describe("the update /guests/permissions sends", () => {
  it("writes all three columns from the form", () => {
    expect(
      buildGuestPermissionsPatch({
        allowPartner: true,
        allowChildren: true,
        capMode: "capped",
        capInput: "2",
      }),
    ).toEqual({
      ok: true,
      patch: {
        allow_guests_add_partner: true,
        allow_guests_add_children: true,
        max_children_per_guest: 2,
      },
    });
  });

  it("turns everything off without leaving a cap behind", () => {
    expect(
      buildGuestPermissionsPatch({
        allowPartner: false,
        allowChildren: false,
        capMode: "capped",
        capInput: "3",
      }),
    ).toEqual({
      ok: true,
      patch: {
        allow_guests_add_partner: false,
        allow_guests_add_children: false,
        max_children_per_guest: null,
      },
    });
  });

  it("keeps the partner toggle independent of the children toggle", () => {
    const result = buildGuestPermissionsPatch({
      allowPartner: true,
      allowChildren: false,
      capMode: "unlimited",
      capInput: "",
    });
    expect(result.ok && result.patch).toEqual({
      allow_guests_add_partner: true,
      allow_guests_add_children: false,
      max_children_per_guest: null,
    });
  });

  it("sends nothing at all when the cap doesn't parse", () => {
    // The form has to keep the couple on the page rather than write a
    // half-valid row, so this stays a failure and not a fallback to null.
    expect(
      buildGuestPermissionsPatch({
        allowPartner: true,
        allowChildren: true,
        capMode: "capped",
        capInput: "",
      }),
    ).toEqual({ ok: false, problem: "not_a_whole_number" });
  });
});

describe("end to end, defaults through to the invitation", () => {
  it("gives a plus-one wedding's inheriting guest a partner option", () => {
    const saved = buildGuestPermissionsPatch({
      allowPartner: true,
      allowChildren: false,
      capMode: "unlimited",
      capInput: "",
    });
    if (!saved.ok) throw new Error("expected the form to resolve");

    const allowed = resolveGuestPermission(
      choiceToOverride("inherit"),
      saved.patch.allow_guests_add_partner,
    );
    expect(canAddPartner({ allowed, hasPartner: false })).toBe(true);
  });

  it("denies a guest pinned to 'no' at a wedding that allows partners", () => {
    const allowed = resolveGuestPermission(choiceToOverride("no"), true);
    expect(canAddPartner({ allowed, hasPartner: false })).toBe(false);
  });

  it("grants a guest pinned to 'yes' at a wedding that doesn't", () => {
    const allowed = resolveGuestPermission(choiceToOverride("yes"), false);
    expect(canAddPartner({ allowed, hasPartner: false })).toBe(true);
  });

  it("carries a saved cap of 2 through to a guest with one child already", () => {
    const saved = buildGuestPermissionsPatch({
      allowPartner: false,
      allowChildren: true,
      capMode: "capped",
      capInput: "2",
    });
    if (!saved.ok) throw new Error("expected the form to resolve");

    const allowed = resolveGuestPermission(
      choiceToOverride("inherit"),
      saved.patch.allow_guests_add_children,
    );
    const remaining = resolveChildrenRemaining({
      canAddChildren: allowed,
      cap: saved.patch.max_children_per_guest,
      used: 1,
    });
    expect(remaining).toBe(1);
    expect(canAddChildren({ allowed, remaining })).toBe(true);
  });

  it("lets a guest pinned to 'yes' add children the wedding disallows, uncapped", () => {
    const saved = buildGuestPermissionsPatch({
      allowPartner: false,
      allowChildren: false,
      capMode: "capped",
      capInput: "1",
    });
    if (!saved.ok) throw new Error("expected the form to resolve");
    // Children off at the wedding level clears the cap, so the guest the
    // couple pinned to "yes" is uncapped rather than stuck at the old 1.
    expect(saved.patch.max_children_per_guest).toBeNull();

    const allowed = resolveGuestPermission(
      choiceToOverride("yes"),
      saved.patch.allow_guests_add_children,
    );
    const remaining = resolveChildrenRemaining({
      canAddChildren: allowed,
      cap: saved.patch.max_children_per_guest,
      used: 3,
    });
    expect(remaining).toBeNull();
    expect(canAddChildren({ allowed, remaining })).toBe(true);
  });

  it("reopens a form on what was saved", () => {
    const saved = buildGuestPermissionsPatch({
      allowPartner: true,
      allowChildren: true,
      capMode: "capped",
      capInput: "500",
    });
    if (!saved.ok) throw new Error("expected the form to resolve");
    // The clamp is what the couple sees on the next visit, not their 500.
    expect(childrenCapFormState(saved.patch.max_children_per_guest)).toEqual({
      mode: "capped",
      input: String(MAX_CHILDREN_CAP),
    });
  });
});
