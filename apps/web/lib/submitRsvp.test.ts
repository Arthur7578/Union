import { describe, expect, it, vi } from "vitest";
import { submitGuestRsvp, type SubmitGuestRsvpInput } from "./submitRsvp";

const baseInput: SubmitGuestRsvpInput = {
  token: "invite-token",
  primaryStatus: "attending",
  primaryDietary: "  Vegetarian  ",
  primaryMessage: "  Looking forward to it!  ",
  companions: [{ id: "partner" }, { id: "child" }, { id: "unanswered" }],
  companionsRsvp: {
    partner: { rsvp_status: "attending", dietary_notes: "  Nut allergy " },
    child: { rsvp_status: "declined", dietary_notes: "" },
    unanswered: { rsvp_status: "pending", dietary_notes: "Not submitted" },
  },
};

function createClient() {
  return {
    submitPrimary: vi.fn(
      async (): Promise<{ error: unknown | null }> => ({ error: null }),
    ),
    submitCompanion: vi.fn(
      async (): Promise<{ error: unknown | null }> => ({ error: null }),
    ),
  };
}

describe("submitGuestRsvp", () => {
  it("submits the primary RSVP with normalized optional fields", async () => {
    const client = createClient();

    await submitGuestRsvp(client, baseInput);

    expect(client.submitPrimary).toHaveBeenCalledOnce();
    expect(client.submitPrimary).toHaveBeenCalledWith({
      p_token: "invite-token",
      p_status: "attending",
      p_dietary_notes: "Vegetarian",
      p_message: "Looking forward to it!",
    });
  });

  it("submits answered companions in order and skips pending or missing answers", async () => {
    const client = createClient();
    const input: SubmitGuestRsvpInput = {
      ...baseInput,
      companions: [...baseInput.companions, { id: "missing" }],
    };

    await submitGuestRsvp(client, input);

    expect(client.submitCompanion).toHaveBeenCalledTimes(2);
    expect(client.submitCompanion).toHaveBeenNthCalledWith(1, {
      p_token: "invite-token",
      p_companion_guest_id: "partner",
      p_status: "attending",
      p_dietary_notes: "Nut allergy",
    });
    expect(client.submitCompanion).toHaveBeenNthCalledWith(2, {
      p_token: "invite-token",
      p_companion_guest_id: "child",
      p_status: "declined",
      p_dietary_notes: undefined,
    });
  });

  it("converts blank primary fields to undefined", async () => {
    const client = createClient();

    await submitGuestRsvp(client, {
      ...baseInput,
      primaryDietary: "   ",
      primaryMessage: "",
    });

    expect(client.submitPrimary).toHaveBeenCalledWith(
      expect.objectContaining({
        p_dietary_notes: undefined,
        p_message: undefined,
      }),
    );
  });

  it("sends a maybe through unchanged, for the guest and their companions", async () => {
    // A party where one person is sure and another isn't is the ordinary
    // case; each reply has to reach the server as the answer the guest gave,
    // not rounded to the nearest yes/no.
    const client = createClient();

    await submitGuestRsvp(client, {
      ...baseInput,
      primaryStatus: "maybe",
      companions: [{ id: "partner" }],
      companionsRsvp: {
        partner: { rsvp_status: "maybe", dietary_notes: "Nut allergy" },
      },
    });

    expect(client.submitPrimary).toHaveBeenCalledWith(
      expect.objectContaining({ p_status: "maybe" }),
    );
    expect(client.submitCompanion).toHaveBeenCalledOnce();
    expect(client.submitCompanion).toHaveBeenCalledWith({
      p_token: "invite-token",
      p_companion_guest_id: "partner",
      p_status: "maybe",
      p_dietary_notes: "Nut allergy",
    });
  });

  it("still collects dietary notes from a guest who only might come", async () => {
    // The notes are worth having before the guest firms up — asking again
    // later is what makes people stop replying.
    const client = createClient();

    await submitGuestRsvp(client, {
      ...baseInput,
      primaryStatus: "maybe",
      companions: [],
      companionsRsvp: {},
    });

    expect(client.submitPrimary).toHaveBeenCalledWith(
      expect.objectContaining({ p_dietary_notes: "Vegetarian" }),
    );
  });

  it("does not submit companions when the primary RSVP fails", async () => {
    const client = createClient();
    const primaryError = new Error("primary failed");
    client.submitPrimary.mockResolvedValueOnce({ error: primaryError });

    await expect(submitGuestRsvp(client, baseInput)).rejects.toBe(primaryError);
    expect(client.submitCompanion).not.toHaveBeenCalled();
  });

  it("stops submitting companions after the first companion failure", async () => {
    const client = createClient();
    const companionError = new Error("companion failed");
    client.submitCompanion.mockResolvedValueOnce({ error: companionError });

    await expect(submitGuestRsvp(client, baseInput)).rejects.toBe(companionError);
    expect(client.submitCompanion).toHaveBeenCalledOnce();
  });
});
