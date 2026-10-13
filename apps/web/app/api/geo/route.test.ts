import { describe, expect, it } from "vitest";
import { GET } from "./route";

const ask = (headers: Record<string, string> = {}) =>
  GET(new Request("http://localhost/api/geo", { headers }));

describe("GET /api/geo", () => {
  it("reports the country the host read from the request's IP address", async () => {
    const res = await ask({ "x-vercel-ip-country": "FR" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ country: "FR" });
  });

  it("normalises case and whitespace", async () => {
    const res = await ask({ "x-vercel-ip-country": " fr " });
    expect(await res.json()).toEqual({ country: "FR" });
  });

  it("says null when the host gave no country (local development, other hosts)", async () => {
    expect(await (await ask()).json()).toEqual({ country: null });
  });

  it("says null for anything a phone number can't belong to", async () => {
    // Tor and unknown-location placeholders, and plain garbage.
    for (const value of ["T1", "XX", "", "FRA", "<script>"]) {
      const res = await ask({ "x-vercel-ip-country": value });
      expect(await res.json()).toEqual({ country: null });
    }
  });

  it("is never cached and shared: the answer differs for every visitor", async () => {
    const res = await ask({ "x-vercel-ip-country": "FR" });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
