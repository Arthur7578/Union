import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  parse: vi.fn(),
}));

vi.mock("@union/shared", () => ({
  createUnionClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    messages = { parse: mocks.parse };
  }
  return { default: Anthropic };
});

import { POST } from "./route";

const FORM_ID = "11111111-1111-4111-8111-111111111111";

const validBody = {
  formId: FORM_ID,
  from: "en",
  to: "fr",
  items: [{ id: "rsvp.title", text: "Will you join us?" }],
};

function post(body: unknown, token: string | null = "good-token") {
  return POST(
    new Request("http://localhost/api/translate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  // supabase.from("forms").select("id").eq("id", formId).maybeSingle()
  mocks.from.mockReturnValue({
    select: () => ({ eq: mocks.eq }),
  });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: { id: FORM_ID }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.parse.mockResolvedValue({
    parsed_output: {
      translations: [{ id: "rsvp.title", text: "Voulez-vous nous rejoindre ?" }],
    },
  });
});

describe("POST /api/translate", () => {
  it("translates for a caller who can edit the form, and counts the call", async () => {
    const res = await post(validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      translations: { "rsvp.title": "Voulez-vous nous rejoindre ?" },
    });
    expect(mocks.from).toHaveBeenCalledWith("forms");
    expect(mocks.eq).toHaveBeenCalledWith("id", FORM_ID);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_bucket: "translate",
    });
    expect(mocks.parse).toHaveBeenCalledOnce();
  });

  it("rejects an unauthenticated request before doing anything else", async () => {
    const res = await post(validBody, null);

    expect(res.status).toBe(401);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it("rejects a token Supabase doesn't recognise", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad") });

    const res = await post(validBody);

    expect(res.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  describe("scope: the caller must be able to edit the form", () => {
    it("refuses a form the caller can't see, without spending quota or calling the model", async () => {
      // RLS hides a form from non-members as an empty result, not an error.
      mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

      const res = await post(validBody);

      expect(res.status).toBe(404);
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("refuses when the lookup itself fails", async () => {
      mocks.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "boom" },
      });

      const res = await post(validBody);

      expect(res.status).toBe(404);
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["not a uuid", "not-a-uuid"],
      ["not a string", 42],
    ])("rejects a formId that is %s", async (_label, formId) => {
      const res = await post({ ...validBody, formId });

      expect(res.status).toBe(400);
      expect(mocks.maybeSingle).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
    });
  });

  describe("rate limit", () => {
    it("refuses once the limit is used up, without calling the model", async () => {
      mocks.rpc.mockResolvedValue({ data: false, error: null });

      const res = await post(validBody);

      expect(res.status).toBe(429);
      expect((await res.json()).error).toMatch(/try again/i);
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("treats anything other than an explicit yes as a no", async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: null });

      const res = await post(validBody);

      expect(res.status).toBe(429);
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("fails closed when the counter can't be reached", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { message: "function public.consume_rate_limit does not exist" },
      });

      const res = await post(validBody);

      expect(res.status).toBe(503);
      expect(mocks.parse).not.toHaveBeenCalled();
    });
  });

  describe("ordering", () => {
    it("doesn't spend quota on a malformed request", async () => {
      const res = await post({ ...validBody, items: [] });

      expect(res.status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("doesn't spend quota when translation isn't configured", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");

      const res = await post(validBody);

      expect(res.status).toBe(503);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
  });

  it("still drops ids the model invented", async () => {
    mocks.parse.mockResolvedValue({
      parsed_output: {
        translations: [
          { id: "rsvp.title", text: "Voulez-vous nous rejoindre ?" },
          { id: "question.made-up.title", text: "Not a slot we asked about" },
        ],
      },
    });

    const res = await post(validBody);

    expect(await res.json()).toEqual({
      translations: { "rsvp.title": "Voulez-vous nous rejoindre ?" },
    });
  });
});
