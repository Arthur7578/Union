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

  it("surfaces the single transaction failure", async () => {
    const error = new Error("This form is closed");
    const submitResponse = vi.fn(async () => ({ error }));

    await expect(submitGuestRsvp({ submitResponse }, baseInput)).rejects.toBe(error);
    expect(submitResponse).toHaveBeenCalledOnce();
  });
});
