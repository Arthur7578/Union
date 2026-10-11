import { describe, expect, it } from "vitest";
import { guestLinkPath, guestLinkUrl } from "@union/shared";

const TOKEN = "3f2b6c1e-8a4d-4e0b-9c7a-1d5e6f7a8b90";

describe("guest links", () => {
  it("points at the guest page, not the legacy /rsvp path", () => {
    expect(guestLinkPath(TOKEN)).toBe(`/guest/${TOKEN}`);
    expect(guestLinkPath(TOKEN)).not.toContain("/rsvp/");
  });

  it("prefixes the origin for sharing", () => {
    expect(guestLinkUrl("https://union-silk.vercel.app", TOKEN)).toBe(
      `https://union-silk.vercel.app/guest/${TOKEN}`,
    );
  });

  it("keeps an empty origin relative, as the SSR render of a client page has", () => {
    expect(guestLinkUrl("", TOKEN)).toBe(`/guest/${TOKEN}`);
  });
});
