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

/** What the builder really sends: `question.<uuid>.option.<uuid>`. */
function realisticId(n: number) {
  const uuid = (k: number) =>
    `${String(k).padStart(8, "0")}-aaaa-4bbb-8ccc-dddddddddddd`;
  return `question.${uuid(n)}.option.${uuid(n + 1000)}`;
}

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

/** The `max_tokens` the route asked the model for on its one call. */
function requestedMaxTokens(): number {
  return mocks.parse.mock.calls[0][0].max_tokens;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

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
  mocks.rpc.mockResolvedValue({ data: "ok", error: null });
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
    expect(mocks.rpc).toHaveBeenCalledWith("consume_translation_quota", {
      p_form_id: FORM_ID,
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

    it("refuses when the database says access went away mid-request", async () => {
      mocks.rpc.mockResolvedValue({ data: "no_access", error: null });

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

  describe("allowance", () => {
    it("tells a user who is over their own limit, without calling the model", async () => {
      mocks.rpc.mockResolvedValue({ data: "user_limit", error: null });

      const res = await post(validBody);

      expect(res.status).toBe(429);
      expect((await res.json()).error).toMatch(/try again/i);
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("pauses for everyone when the daily budget is used up, and says so in the logs", async () => {
      mocks.rpc.mockResolvedValue({ data: "global_limit", error: null });

      const res = await post(validBody);

      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatch(/tomorrow/i);
      expect(console.warn).toHaveBeenCalledOnce();
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("fails closed when the counter can't be reached", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: {
          message: "function public.consume_translation_quota does not exist",
        },
      });

      const res = await post(validBody);

      expect(res.status).toBe(503);
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it.each([
      ["null", null],
      ["a boolean", true],
      ["a word it doesn't know", "maybe"],
    ])("fails closed on an answer that is %s", async (_label, answer) => {
      mocks.rpc.mockResolvedValue({ data: answer, error: null });

      const res = await post(validBody);

      expect(res.status).toBe(503);
      expect(mocks.parse).not.toHaveBeenCalled();
    });
  });

  describe("request size", () => {
    it("rejects an id long enough to inflate the request", async () => {
      // The model has to echo every id back, so a long id is a long answer.
      const res = await post({
        ...validBody,
        items: [{ id: "x".repeat(129), text: "Hello" }],
      });

      expect(res.status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("accepts the longest id the builder really produces", async () => {
      const id = realisticId(1);
      expect(id.length).toBeLessThanOrEqual(128);
      mocks.parse.mockResolvedValue({
        parsed_output: { translations: [{ id, text: "Bonjour" }] },
      });

      const res = await post({ ...validBody, items: [{ id, text: "Hello" }] });

      expect(res.status).toBe(200);
    });

    it("refuses a form with more text than one call should carry, before spending anything", async () => {
      // Every field passes on its own; together they're far past a real form.
      const items = Array.from({ length: 120 }, (_, n) => ({
        id: realisticId(n),
        text: "x".repeat(600),
      }));

      const res = await post({ ...validBody, items });

      expect(res.status).toBe(413);
      expect((await res.json()).error).toMatch(/by hand/i);
      expect(mocks.maybeSingle).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
    });

    it("still takes a big, realistic form", async () => {
      // 120 slots of ordinary label length with real ids: well under the cap.
      const items = Array.from({ length: 120 }, (_, n) => ({
        id: realisticId(n),
        text: "Vegetarian, no nuts please",
      }));
      mocks.parse.mockResolvedValue({
        parsed_output: {
          translations: items.map((i) => ({ id: i.id, text: "Végétarien" })),
        },
      });

      const res = await post({ ...validBody, items });

      expect(res.status).toBe(200);
      expect(Object.keys((await res.json()).translations)).toHaveLength(120);
    });

    it("asks for output room that scales with the request, within bounds", async () => {
      // A small form gets the floor, not the old flat 8000.
      await post(validBody);
      expect(requestedMaxTokens()).toBe(2000);

      // The biggest form that passes the cap gets the ceiling.
      vi.mocked(mocks.parse).mockClear();
      const items = Array.from({ length: 120 }, (_, n) => ({
        id: realisticId(n),
        text: "x".repeat(100),
      }));
      mocks.parse.mockResolvedValue({ parsed_output: { translations: [] } });
      await post({ ...validBody, items });
      expect(requestedMaxTokens()).toBe(8000);
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
