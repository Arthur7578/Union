import type { FormAnswers } from "@union/shared";

export type AnsweredRsvpStatus = "attending" | "declined";
export type RsvpStatus = AnsweredRsvpStatus | "pending";

export interface SubmitRsvpResponseArgs {
  p_token: string;
  p_form_id: string | null;
  p_status: AnsweredRsvpStatus;
  p_companions: Array<{
    guest_id: string;
    status: AnsweredRsvpStatus;
  }>;
  p_answers: Array<{
    guest_id: string;
    answers: FormAnswers;
  }>;
}

interface RpcResult {
  error: unknown | null;
}

export interface RsvpRpcClient {
  submitResponse(args: SubmitRsvpResponseArgs): PromiseLike<RpcResult>;
}

export interface Companion {
  id: string;
}

export interface CompanionRsvp {
  rsvp_status: RsvpStatus;
}

export interface SubmitGuestRsvpInput {
  token: string;
  formId: string | null;
  primaryStatus: AnsweredRsvpStatus;
  companions: Companion[];
  companionsRsvp: Record<string, CompanionRsvp>;
  responses: Array<{ guestId: string; answers: FormAnswers }>;
}

/** Submit the household's RSVP statuses and the active RSVP form answers in
 * one database transaction. The RPC owns the transaction boundary; one
 * rejected closed form or delegated response therefore leaves no status
 * changes behind. */
export async function submitGuestRsvp(
  client: RsvpRpcClient,
  input: SubmitGuestRsvpInput,
): Promise<void> {
  const companions = input.companions.flatMap((companion) => {
    const state = input.companionsRsvp[companion.id];
    if (!state || state.rsvp_status === "pending") return [];
    return [{ guest_id: companion.id, status: state.rsvp_status }];
  });

  const { error } = await client.submitResponse({
    p_token: input.token,
    p_form_id: input.formId,
    p_status: input.primaryStatus,
    p_companions: companions,
    p_answers: input.responses.map((response) => ({
      guest_id: response.guestId,
      answers: response.answers,
    })),
  });
  if (error) throw error;
}
