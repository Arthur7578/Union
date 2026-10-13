import type { Enums } from "./database.types";

/**
 * Which answers an RSVP actually offers.
 *
 * 'maybe' exists because a yes/no-only RSVP makes an unsure guest guess, and a
 * guess that gets quietly revised later reaches the couple as a status flip
 * with no hint that the guest was ever unsure. But a third answer changes what
 * a headcount means, so it is the couple's decision — `allowMaybe` is their
 * `weddings.allow_rsvp_maybe`, and with it off everything here behaves exactly
 * as it did before 'maybe' existed.
 *
 * The same rule is enforced in SQL by `public._rsvp_status_allowed`, which is
 * the one that actually protects the data — this module is what keeps the UI
 * from offering a button the server would refuse.
 */

export type RsvpStatus = Enums<"rsvp_status">;

/** A reply a guest has actually given. Everything except 'pending', which is
 *  the absence of an answer rather than one of them. */
export type AnsweredRsvpStatus = Exclude<RsvpStatus, "pending">;

/** Every answer, in the order guests read them: yes, unsure, no. 'maybe' sits
 *  in the middle deliberately — it is a point on a scale between the other
 *  two, and putting it last would read as an afterthought. */
export const RSVP_ANSWERS: readonly AnsweredRsvpStatus[] = [
  "attending",
  "maybe",
  "declined",
] as const;

/** The answers this wedding offers, in display order. */
export function rsvpAnswers(allowMaybe: boolean): AnsweredRsvpStatus[] {
  return RSVP_ANSWERS.filter((s) => s !== "maybe" || allowMaybe);
}

/** Whether a status is one this wedding will accept as a reply. Mirrors the
 *  server's check so a disabled option is never offered in the first place. */
export function isRsvpAnswerAllowed(
  status: RsvpStatus | "" | null | undefined,
  allowMaybe: boolean,
): status is AnsweredRsvpStatus {
  if (status === "attending" || status === "declined") return true;
  return status === "maybe" && allowMaybe;
}

/** Whether an answer means the guest expects to be there — used to decide
 *  whether to ask the follow-up questions that only make sense for someone
 *  who might come (dietary notes, their companions' replies). A 'maybe' guest
 *  gets asked: the answers are worth having before they firm up, and asking
 *  again later is the thing that makes people stop replying. */
export function mayAttend(status: RsvpStatus | "" | null | undefined): boolean {
  return status === "attending" || status === "maybe";
}

/** A guest list rolled up into the counts organisers plan against.
 *
 *  `headcount` stays what it has always been — replies that are a firm yes —
 *  so nothing that read it before starts silently including unsure guests.
 *  `headcountMax` is the number to book against: the ceiling if every maybe
 *  turns into a yes. With the option off the two are equal, and the range
 *  collapses to the single number couples saw before. */
export type RsvpRollup = {
  invited: number;
  coming: number;
  maybe: number;
  declined: number;
  waiting: number;
  headcount: number;
  headcountMax: number;
};

/** Roll a list of statuses up into those counts. Anything that isn't a real
 *  answer — 'pending', a missing rsvp row — counts as still waiting. */
export function rollUpRsvps(
  statuses: Iterable<RsvpStatus | null | undefined>,
): RsvpRollup {
  let invited = 0;
  let coming = 0;
  let maybe = 0;
  let declined = 0;
  let waiting = 0;
  for (const status of statuses) {
    invited += 1;
    if (status === "attending") coming += 1;
    else if (status === "maybe") maybe += 1;
    else if (status === "declined") declined += 1;
    else waiting += 1;
  }
  return {
    invited,
    coming,
    maybe,
    declined,
    waiting,
    headcount: coming,
    headcountMax: coming + maybe,
  };
}
