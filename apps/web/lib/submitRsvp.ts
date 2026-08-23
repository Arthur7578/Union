import type { AnsweredRsvpStatus, RsvpStatus } from "@union/shared";

export type { AnsweredRsvpStatus, RsvpStatus };

export interface PrimaryRsvpArgs {
  p_token: string;
  p_status: AnsweredRsvpStatus;
  p_dietary_notes: string | undefined;
  p_message: string | undefined;
}

export interface CompanionRsvpArgs {
  p_token: string;
  p_companion_guest_id: string;
  p_status: AnsweredRsvpStatus;
  p_dietary_notes: string | undefined;
}

interface RpcResult {
  error: unknown | null;
}

export interface RsvpRpcClient {
  submitPrimary(args: PrimaryRsvpArgs): PromiseLike<RpcResult>;
  submitCompanion(args: CompanionRsvpArgs): PromiseLike<RpcResult>;
}

export interface Companion {
  id: string;
}

export interface CompanionRsvp {
  rsvp_status: RsvpStatus;
  dietary_notes: string;
}

export interface SubmitGuestRsvpInput {
  token: string;
  primaryStatus: AnsweredRsvpStatus;
  primaryDietary: string;
  primaryMessage: string;
  companions: Companion[];
  companionsRsvp: Record<string, CompanionRsvp>;
}

function optionalTrimmed(value: string): string | undefined {
  return value.trim() || undefined;
}

export async function submitGuestRsvp(
  client: RsvpRpcClient,
  input: SubmitGuestRsvpInput,
): Promise<void> {
  const { error: primaryError } = await client.submitPrimary({
    p_token: input.token,
    p_status: input.primaryStatus,
    p_dietary_notes: optionalTrimmed(input.primaryDietary),
    p_message: optionalTrimmed(input.primaryMessage),
  });
  if (primaryError) throw primaryError;

  for (const companion of input.companions) {
    const companionState = input.companionsRsvp[companion.id];
    if (!companionState || companionState.rsvp_status === "pending") continue;

    const { error: companionError } = await client.submitCompanion({
      p_token: input.token,
      p_companion_guest_id: companion.id,
      p_status: companionState.rsvp_status,
      p_dietary_notes: optionalTrimmed(companionState.dietary_notes),
    });
    if (companionError) throw companionError;
  }
}
