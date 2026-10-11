import { describe, expect, it, vi } from "vitest";
import { submitGuestRsvp, type SubmitGuestRsvpInput } from "./submitRsvp";

const baseInput: SubmitGuestRsvpInput = {
  token: "invite-token",
  formId: "rsvp-form",
  primaryStatus: "attending",
  companions: [{ id: "partner" }, { id: "child" }, { id: "unanswered" }],
  companionsRsvp: {
    partner: { rsvp_status: "attending" },
    child: { rsvp_status: "declined" },
    unanswered: { rsvp_status: "pending" },
  },
  responses: [
    { guestId: "guest", answers: { dietary: "Vegetarian" } },
    { guestId: "partner", answers: {} },
  ],
  allowMaybe: false,
};

describe("submitGuestRsvp", () => {
  it("sends statuses and answers through one atomic RPC", async () => {
    const submitResponse = vi.fn(async () => ({ error: null }));

    await submitGuestRsvp({ submitResponse }, baseInput);

    expect(submitResponse).toHaveBeenCalledOnce();
    expect(submitResponse).toHaveBeenCalledWith({
      p_token: "invite-token",
      p_form_id: "rsvp-form",
      p_status: "attending",
      p_companions: [
        { guest_id: "partner", status: "attending" },
        { guest_id: "child", status: "declined" },
      ],
      p_answers: [
        { guest_id: "guest", answers: { dietary: "Vegetarian" } },
        { guest_id: "partner", answers: {} },
      ],
    });
  });

  it("allows a question-less compatibility submission without a form id", async () => {
    const submitResponse = vi.fn(async () => ({ error: null }));

    await submitGuestRsvp(
      { submitResponse },
      { ...baseInput, formId: null, responses: [] },
    );

    expect(submitResponse).toHaveBeenCalledWith(
      expect.objectContaining({ p_form_id: null, p_answers: [] }),
    );
  });

  it("sends a maybe through unchanged, for the guest and their companions", async () => {
    // A party where one person is sure and another isn't is the ordinary
    // case; each reply has to reach the server as the answer the guest gave,
    // not rounded to the nearest yes/no.
    const submitResponse = vi.fn(async () => ({ error: null }));

    await submitGuestRsvp(
      { submitResponse },
      {
        ...baseInput,
        allowMaybe: true,
        primaryStatus: "maybe",
        companions: [{ id: "partner" }, { id: "child" }],
        companionsRsvp: {
          partner: { rsvp_status: "maybe" },
          child: { rsvp_status: "attending" },
        },
      },
    );

    expect(submitResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        p_status: "maybe",
        p_companions: [
          { guest_id: "partner", status: "maybe" },
          { guest_id: "child", status: "attending" },
        ],
      }),
    );
  });

  it("leaves a companion's old maybe alone once the couple has turned the option off", async () => {
    // The couple turned "maybe" off after this companion answered it. The
    // server refuses a maybe the wedding no longer accepts, and the household
    // is one transaction — so re-sending the stale maybe would fail the whole
    // reply, including the answers the guest just gave. Their reply stays on
    // file untouched instead; the others still go through.
    const submitResponse = vi.fn(async () => ({ error: null }));

    await submitGuestRsvp(
      { submitResponse },
      {
        ...baseInput,
        allowMaybe: false,
        companions: [{ id: "stale-maybe" }, { id: "changed" }],
        companionsRsvp: {
          "stale-maybe": { rsvp_status: "maybe" },
          changed: { rsvp_status: "declined" },
        },
      },
    );

    expect(submitResponse).toHaveBeenCalledOnce();
    expect(submitResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        p_companions: [{ guest_id: "changed", status: "declined" }],
      }),
    );
  });

  it("sends a companion's answer again when they pick a firm one after an old maybe", async () => {
    // Choosing yes or no for the companion is a new answer, not a stale
    // leftover, so it must reach the server even with the option off.
    const submitResponse = vi.fn(async () => ({ error: null }));

    await submitGuestRsvp(
      { submitResponse },
      {
        ...baseInput,
        allowMaybe: false,
        companions: [{ id: "partner" }],
        companionsRsvp: { partner: { rsvp_status: "attending" } },
      },
    );

    expect(submitResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        p_companions: [{ guest_id: "partner", status: "attending" }],
      }),
    );
  });

  it("surfaces the single transaction failure", async () => {
    const error = new Error("This form is closed");
    const submitResponse = vi.fn(async () => ({ error }));

    await expect(submitGuestRsvp({ submitResponse }, baseInput)).rejects.toBe(error);
    expect(submitResponse).toHaveBeenCalledOnce();
  });
});
