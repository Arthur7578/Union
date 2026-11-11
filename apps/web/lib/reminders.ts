import type { Wedding } from "@union/shared";

/**
 * How RSVP reminders go out for a wedding.
 *
 * - "union": Union sends the emails itself through the wedding's own email
 *   sender, so it knows they left and records each guest as nudged.
 * - "manual": no sender is set up. Union opens the couple's own mail app with
 *   the guests in Bcc; it cannot know whether the email was sent, so it never
 *   records a nudge on its own. The couple can note it afterwards if they want.
 *
 * Union has no email sender yet (Brevo is only wired for SMS), so every
 * wedding is "manual" today. When the sender lands, decide here from the
 * wedding's sender settings, e.g. a verified sender address and a working key.
 */
export type ReminderMode = "union" | "manual";

export function reminderMode(wedding: Pick<Wedding, "id">): ReminderMode {
  void wedding;
  return "manual";
}
