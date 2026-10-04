import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetRequestCountry, getRequestCountry } from "@/lib/requestCountry";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn();

beforeEach(() => {
  forgetRequestCountry();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getRequestCountry", () => {
  it("returns the country /api/geo reports", async () => {
    fetchMock.mockResolvedValue(reply({ country: "FR" }));
    expect(await getRequestCountry()).toBe("FR");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/geo",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });

  it("returns null when it can't be told, and never throws", async () => {
    fetchMock.mockResolvedValueOnce(reply({ country: null }));
    expect(await getRequestCountry()).toBeNull();

    // Not a country a phone number can belong to.
    forgetRequestCountry();
    fetchMock.mockResolvedValueOnce(reply({ country: "ZZ" }));
    expect(await getRequestCountry()).toBeNull();

    forgetRequestCountry();
    fetchMock.mockResolvedValueOnce(reply({ error: "no" }, 500));
    expect(await getRequestCountry()).toBeNull();

    forgetRequestCountry();
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(await getRequestCountry()).toBeNull();

    forgetRequestCountry();
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    expect(await getRequestCountry()).toBeNull();
  });

  it("asks once per page load, however many fields want the answer", async () => {
    fetchMock.mockResolvedValue(reply({ country: "BE" }));
    const [a, b] = await Promise.all([getRequestCountry(), getRequestCountry()]);
    expect([a, b]).toEqual(["BE", "BE"]);
    expect(await getRequestCountry()).toBe("BE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
