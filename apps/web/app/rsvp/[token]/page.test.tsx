import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((to: string): never => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

import RsvpRedirectPage from "./page";

const TOKEN = "3f2b6c1e-8a4d-4e0b-9c7a-1d5e6f7a8b90";

describe("legacy /rsvp/<token> links", () => {
  it("still resolve, by redirecting to the guest page", async () => {
    await expect(
      RsvpRedirectPage({ params: Promise.resolve({ token: TOKEN }) }),
    ).rejects.toThrow(`NEXT_REDIRECT:/guest/${TOKEN}`);
    expect(redirect).toHaveBeenCalledWith(`/guest/${TOKEN}`);
  });
});
