// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { markRsvpHandoff, takeRsvpHandoff } from "./rsvpHandoff";

beforeEach(() => window.sessionStorage.clear());

describe("RSVP handoff", () => {
  it("is taken once, then gone", () => {
    markRsvpHandoff("tok");
    expect(takeRsvpHandoff("tok")).toBe(true);
    expect(takeRsvpHandoff("tok")).toBe(false);
  });

  it("belongs to one invitation", () => {
    markRsvpHandoff("tok-a");
    expect(takeRsvpHandoff("tok-b")).toBe(false);
    expect(takeRsvpHandoff("tok-a")).toBe(true);
  });
});
