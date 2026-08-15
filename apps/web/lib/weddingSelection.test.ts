import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_WEDDING_KEY,
  ACTIVE_WEDDING_USER_KEY,
  INVITED_WEDDING_KEY,
  clearActiveWedding,
  clearActiveWeddingPreference,
  readActiveWedding,
  rememberActiveWedding,
  rememberInvitedWedding,
  resolveInitialWeddingId,
} from "./weddingSelection";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function installWindow() {
  const sessionStorage = createStorage();
  const localStorage = createStorage();
  vi.stubGlobal("window", { sessionStorage, localStorage });
  return { sessionStorage, localStorage };
}

afterEach(() => vi.unstubAllGlobals());

describe("account-scoped wedding selection", () => {
  it("never auto-selects an invitation", () => {
    expect(
      resolveInitialWeddingId(
        "invited-wedding",
        "previous-wedding",
        ["invited-wedding", "previous-wedding"],
      ),
    ).toBeNull();
  });

  it("uses an ordinary active preference or sole accessible wedding", () => {
    expect(
      resolveInitialWeddingId(null, "wedding-b", ["wedding-a", "wedding-b"]),
    ).toBe("wedding-b");
    expect(resolveInitialWeddingId(null, null, ["wedding-a"])).toBe(
      "wedding-a",
    );
    expect(
      resolveInitialWeddingId(null, "unavailable", ["wedding-a", "wedding-b"]),
    ).toBeNull();
  });

  it("remembers the invited wedding without selecting it", () => {
    installWindow();

    rememberInvitedWedding("invited-wedding");

    expect(window.sessionStorage.getItem(INVITED_WEDDING_KEY)).toBe(
      "invited-wedding",
    );
    expect(window.sessionStorage.getItem(ACTIVE_WEDDING_KEY)).toBeNull();
  });

  it("returns a selection only to the account that made it", () => {
    installWindow();
    rememberActiveWedding("wedding-a", "user-a");

    expect(readActiveWedding("user-a")).toBe("wedding-a");
    expect(readActiveWedding("user-b")).toBeNull();
    expect(window.sessionStorage.getItem(ACTIVE_WEDDING_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(ACTIVE_WEDDING_USER_KEY)).toBeNull();
  });

  it("rejects legacy wedding ids that have no account scope", () => {
    installWindow();
    window.sessionStorage.setItem(ACTIVE_WEDDING_KEY, "legacy-wedding");

    expect(readActiveWedding("user-a")).toBeNull();
  });

  it("preserves an invitation while clearing an account preference", () => {
    installWindow();
    rememberActiveWedding("wedding-a", "user-a");
    window.sessionStorage.setItem(INVITED_WEDDING_KEY, "invited-wedding");

    clearActiveWeddingPreference();

    expect(window.sessionStorage.getItem(ACTIVE_WEDDING_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(ACTIVE_WEDDING_USER_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(INVITED_WEDDING_KEY)).toBe(
      "invited-wedding",
    );
  });

  it("clears the invitation on full sign-out cleanup", () => {
    installWindow();
    window.sessionStorage.setItem(INVITED_WEDDING_KEY, "invited-wedding");

    clearActiveWedding();

    expect(window.sessionStorage.getItem(INVITED_WEDDING_KEY)).toBeNull();
  });
});
