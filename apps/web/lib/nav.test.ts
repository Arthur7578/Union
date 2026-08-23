import { describe, expect, it } from "vitest";
import { activeNavKey } from "./nav";

describe("activeNavKey", () => {
  it("matches each tab, including its sub-routes", () => {
    expect(activeNavKey("/today")).toBe("today");
    expect(activeNavKey("/vendors")).toBe("vendors");
    expect(activeNavKey("/vendors/abc-123")).toBe("vendors");
    expect(activeNavKey("/guests/seating")).toBe("guests");
    expect(activeNavKey("/plan/team")).toBe("plan");
  });

  it("prefers Union over Vendors for the search flow", () => {
    expect(activeNavKey("/vendors/search")).toBe("union");
    expect(activeNavKey("/vendors/search/active")).toBe("union");
  });

  it("leaves every tab inactive off the tabs — the account area is not one", () => {
    expect(activeNavKey("/account")).toBeNull();
    expect(activeNavKey("/account/feedback")).toBeNull();
    expect(activeNavKey("/account/settings/notifications")).toBeNull();
    expect(activeNavKey("/")).toBeNull();
  });
});
