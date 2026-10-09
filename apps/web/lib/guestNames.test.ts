import { describe, expect, it } from "vitest";
import { groupLinkNameClash, normalizeGuestName } from "./guestNames";

describe("normalizeGuestName", () => {
  it("ignores case, accents, spaces and hyphens", () => {
    expect(normalizeGuestName(" Léa-Rose ")).toBe("learose");
    expect(normalizeGuestName("lea rose")).toBe("learose");
    expect(normalizeGuestName("MAËL")).toBe("mael");
    expect(normalizeGuestName(null)).toBe("");
  });
});

describe("groupLinkNameClash", () => {
  const list = [
    { id: "1", first_name: "Zaza", last_name: null },
    { id: "2", first_name: "Paul", last_name: "Martin" },
  ];

  it("flags a second guest with the same first name and no way to tell them apart", () => {
    expect(groupLinkNameClash(list, "zaza", "Durand")?.id).toBe("1");
    expect(groupLinkNameClash(list, "Paul", "")?.id).toBe("2");
    expect(groupLinkNameClash(list, "Paul", "martin")?.id).toBe("2");
  });

  it("is quiet when the last names tell them apart", () => {
    expect(groupLinkNameClash(list, "Paul", "Durand")).toBeNull();
  });

  it("is quiet for a new first name", () => {
    expect(groupLinkNameClash(list, "Marie", "")).toBeNull();
    expect(groupLinkNameClash(list, "", "")).toBeNull();
  });
});
