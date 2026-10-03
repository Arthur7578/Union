import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  guest: null as Record<string, unknown> | null,
  guestSelects: [] as string[],
}));

// The route talks to Supabase through the caller's JWT client. Only the
// shape it reads is faked here; the point is what the route does with the
// guest row the database hands back.
vi.mock("@union/shared", () => ({
  createUnionClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "owner-1" } }, error: null }),
    },
    from: (table: string) => ({
      select: (columns: string) => {
        if (table === "guests") harness.guestSelects.push(columns);
        return {
          eq: () => ({
            maybeSingle: async () => ({
              data:
                table === "weddings"
                  ? {
                      id: "wedding-1",
                      owner_id: "owner-1",
                      partner_one: "Camille",
                      partner_two: "Alex",
                      sms_sender: "Union",
                      sms_template: "Bonjour {{guest_first_name}}",
                      sms_brevo_api_key: "brevo-key",
                    }
                  : harness.guest,
              error: null,
            }),
          }),
        };
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { POST } from "./route";

const brevo = vi.fn();

const send = () =>
  POST(
    new Request("http://localhost/api/send-sms", {
      method: "POST",
      headers: {
        authorization: "Bearer owner-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify({ weddingId: "wedding-1", guestId: "guest-1" }),
    }),
  );

beforeEach(() => {
  harness.guest = null;
  harness.guestSelects = [];
  brevo.mockReset();
  brevo.mockResolvedValue(new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", brevo);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/send-sms recipient", () => {
  it("sends to the database's phone_e164, not a re-derivation of what was typed", async () => {
    // What the organiser typed is a local French mobile; the generated
    // column has already turned it into the international number.
    harness.guest = {
      id: "guest-1",
      wedding_id: "wedding-1",
      first_name: "Léa",
      phone: "06 12 34 56 78",
      phone_e164: "+33612345678",
      invite_token: "tok",
    };

    const res = await send();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ recipient: "+33612345678" });
    expect(brevo).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(brevo.mock.calls[0][1].body as string);
    expect(sent.recipient).toBe("+33612345678");
    // Reading it is the whole fix: the route has to ask for the column.
    expect(harness.guestSelects[0]).toContain("phone_e164");
  });

  it("refuses to send when the database could not normalise the number", async () => {
    // phone_e164 is null for anything the normaliser can't resolve to an
    // international number. Guessing a country code here is how
    // "+0612345678" got sent in the first place.
    harness.guest = {
      id: "guest-1",
      wedding_id: "wedding-1",
      first_name: "Léa",
      phone: "12345",
      phone_e164: null,
      invite_token: "tok",
    };

    const res = await send();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This guest doesn't have a valid phone number.",
    });
    expect(brevo).not.toHaveBeenCalled();
  });
});
