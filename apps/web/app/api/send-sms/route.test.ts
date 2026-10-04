import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  guest: null as Record<string, unknown> | null,
  guestSelects: [] as string[],
}));

// The route talks to Supabase through the caller's JWT client. Only that
// client is faked, and only the shape the route reads; the point is what the
// route does with the guest row the database hands back. Everything else in
// the shared package stays real, so the route can start using another of its
// exports (it did, for the guest link) without this test breaking.
vi.mock("@union/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@union/shared")>()),
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
  it("sends to the database's phone_e164, not a re-derivation of the stored text", async () => {
    // A number that states its country but is written the way people write
    // it: the bracketed trunk 0 is not part of the number. The generated
    // column drops it; stripping punctuation and prefixing "+" keeps it
    // and sends "+330612345678".
    harness.guest = {
      id: "guest-1",
      wedding_id: "wedding-1",
      first_name: "Léa",
      phone: "+33 (0)6 12 34 56 78",
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

  it("refuses a national-format number whose country the database does not know", async () => {
    // Saved before phone numbers were captured with a country: the text is
    // kept as typed, and phone_e164 is null because the same digits belong
    // to different countries. Prefixing "+" here is how "+0612345678" got
    // sent in the first place.
    harness.guest = {
      id: "guest-1",
      wedding_id: "wedding-1",
      first_name: "Léa",
      phone: "06 12 34 56 78",
      phone_e164: null,
      invite_token: "tok",
    };

    const res = await send();

    expect(res.status).toBe(400);
    // Says what to do, not just that something is wrong: the number looks
    // fine to the organiser, so "invalid" would send them hunting.
    expect(await res.json()).toEqual({
      error:
        "This guest's phone number doesn't say which country it's in. Re-save this guest's phone number with its country, then try again.",
    });
    expect(brevo).not.toHaveBeenCalled();
  });

  it("refuses a number that looks canonical to the database but isn't a real number", async () => {
    // A French number typed while the phone field sat on the United States is
    // saved as +10612345678. The database only checks the shape, so
    // phone_e164 is set; Brevo would be asked to text a number that doesn't
    // exist.
    harness.guest = {
      id: "guest-1",
      wedding_id: "wedding-1",
      first_name: "Léa",
      phone: "+10612345678",
      phone_e164: "+10612345678",
      invite_token: "tok",
    };

    const res = await send();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error:
        "This guest's phone number doesn't look complete or valid. Re-enter it in this guest's details and save, then try again.",
    });
    expect(brevo).not.toHaveBeenCalled();
  });

  it("refuses a number whose trunk 0 was kept after the country code", async () => {
    // "+33 06 12 34 56 78" is stored as +330612345678: the database leaves an
    // unbracketed 0 alone. libphonenumber forgives it, but Brevo is sent the
    // string as it is, and that is not a routable number.
    harness.guest = {
      id: "guest-1",
      wedding_id: "wedding-1",
      first_name: "Léa",
      phone: "+33 06 12 34 56 78",
      phone_e164: "+330612345678",
      invite_token: "tok",
    };

    const res = await send();

    expect(res.status).toBe(400);
    expect(brevo).not.toHaveBeenCalled();
  });

  it("does not ask for a country when there is no number at all", async () => {
    harness.guest = {
      id: "guest-1",
      wedding_id: "wedding-1",
      first_name: "Léa",
      phone: "  ",
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
