import { describe, expect, it } from "vitest";
import { guestEmailStatus } from "./guestEmailStatus";

describe("guestEmailStatus", () => {
  it("reports no email", () => {
    expect(guestEmailStatus({ email: null, email_source: null, email_confirmed_at: null })).toBe("none");
    expect(guestEmailStatus({ email: "  ", email_source: null, email_confirmed_at: null })).toBe("none");
  });

  it("says who entered an unconfirmed email", () => {
    expect(
      guestEmailStatus({ email: "a@b.co", email_source: "organiser", email_confirmed_at: null }),
    ).toBe("organiserUnconfirmed");
    expect(
      guestEmailStatus({ email: "a@b.co", email_source: "guest", email_confirmed_at: null }),
    ).toBe("guestUnconfirmed");
  });

  it("calls a confirmed email confirmed, whoever entered it", () => {
    expect(
      guestEmailStatus({ email: "a@b.co", email_source: "guest", email_confirmed_at: "2026-10-05T10:00:00Z" }),
    ).toBe("confirmed");
    expect(
      guestEmailStatus({ email: "a@b.co", email_source: "organiser", email_confirmed_at: "2026-10-05T10:00:00Z" }),
    ).toBe("confirmed");
  });
});
