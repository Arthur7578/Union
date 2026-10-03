import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

type Err = { message: string; code?: string; status?: number } | null;

/** What the fake Supabase client answers, per test. */
const upstream = vi.hoisted(() => ({
  recipientExists: false as boolean,
  lookupErr: null as Err,
  otpErr: null as Err,
  inviteErr: null as Err,
}));

vi.mock("@union/shared", () => {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "owner-1", email: "owner@example.com" } },
        error: null,
      }),
      signInWithOtp: async () => ({ error: upstream.otpErr }),
      admin: { inviteUserByEmail: async () => ({ error: upstream.inviteErr }) },
    },
    from: () => ({
      // weddings: .select().eq().maybeSingle()
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "w1",
              owner_id: "owner-1",
              partner_one: "Maya",
              partner_two: "Daniel",
            },
            error: null,
          }),
        }),
      }),
      // wedding_collaborators: .insert().select().single()
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "c1",
              wedding_id: "w1",
              email: "guest@example.com",
              status: "pending",
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async () => ({
      data: upstream.recipientExists,
      error: upstream.lookupErr,
    }),
  };
  return { createUnionClient: () => client };
});

/** The admin key is read when the route module loads, so each case sets the
 *  environment first and imports a fresh copy. */
async function post(opts: { adminKey: boolean }) {
  vi.resetModules();
  vi.stubEnv("SUPABASE_SECRET_KEY", opts.adminKey ? "sb_secret_test" : "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  const { POST } = await import("./route");
  const res = await POST(
    new Request("http://localhost/api/invite-collaborator", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ weddingId: "w1", email: "guest@example.com" }),
    }),
  );
  const text = await res.text();
  return { json: JSON.parse(text) as Record<string, unknown>, text };
}

let logged: MockInstance<typeof console.error>;

beforeEach(() => {
  upstream.recipientExists = false;
  upstream.lookupErr = null;
  upstream.otpErr = null;
  upstream.inviteErr = null;
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** The inviter's response must stay free of upstream/operator text; the
 *  detail belongs in the server log. */
function expectQuietResponse(body: { json: Record<string, unknown>; text: string }) {
  expect(body.json.delivered).toBe(false);
  expect(body.json).not.toHaveProperty("reason");
  expect(body.json.collaborator).toMatchObject({ id: "c1" });
}

function loggedText(): string {
  return logged.mock.calls
    .map((call) =>
      call.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
    )
    .join("\n");
}

describe("invite-collaborator: delivery failures after the invite is saved", () => {
  it("no admin key: says nothing operator-facing, logs how to fix it", async () => {
    const body = await post({ adminKey: false });

    expectQuietResponse(body);
    expect(body.text).not.toMatch(/SUPABASE|VERCEL|redeploy/i);
    expect(loggedText()).toContain("SUPABASE_SECRET_KEY");
    expect(loggedText()).toContain("redeploy");
  });

  it("recipient lookup fails: keeps the Postgres error out of the response", async () => {
    upstream.lookupErr = {
      message: "permission denied for function invitation_recipient_exists",
      code: "42501",
    };
    const body = await post({ adminKey: true });

    expectQuietResponse(body);
    expect(body.text).not.toContain("permission denied");
    expect(loggedText()).toContain("permission denied");
    expect(loggedText()).toContain("42501");
  });

  it("sign-in email to an existing account fails: keeps the Auth error out", async () => {
    upstream.recipientExists = true;
    upstream.otpErr = {
      message: "email rate limit exceeded",
      code: "over_email_send_rate_limit",
      status: 429,
    };
    const body = await post({ adminKey: true });

    expectQuietResponse(body);
    expect(body.text).not.toContain("rate limit");
    expect(loggedText()).toContain("email rate limit exceeded");
    expect(loggedText()).toContain("429");
  });

  it("admin invite fails: keeps the Auth error out", async () => {
    upstream.inviteErr = { message: "Error sending invite email", status: 500 };
    const body = await post({ adminKey: true });

    expectQuietResponse(body);
    expect(body.text).not.toContain("Error sending invite email");
    expect(loggedText()).toContain("Error sending invite email");
  });

  it("account appears mid-invite and the retry fails: same quiet response", async () => {
    upstream.inviteErr = { message: "User already registered", code: "email_exists" };
    upstream.otpErr = { message: "smtp unavailable", status: 500 };
    const body = await post({ adminKey: true });

    expectQuietResponse(body);
    expect(body.text).not.toContain("smtp unavailable");
    expect(loggedText()).toContain("smtp unavailable");
  });
});

describe("invite-collaborator: successful delivery is unchanged", () => {
  it("existing account gets the sign-in email", async () => {
    upstream.recipientExists = true;
    const { json } = await post({ adminKey: false });

    expect(json).toMatchObject({ delivered: true, kind: "existing" });
    expect(logged).not.toHaveBeenCalled();
  });

  it("new address gets an admin invite", async () => {
    const { json } = await post({ adminKey: true });

    expect(json).toMatchObject({ delivered: true, kind: "invited" });
    expect(logged).not.toHaveBeenCalled();
  });
});
