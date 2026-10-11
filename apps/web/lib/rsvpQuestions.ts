import type { RsvpQuestion } from "@union/shared";

/** The built-in dietary question's stable id. A guest who declines is not
 *  asked it: there is no meal to plan for them. */
export const RSVP_DIETARY_QUESTION_ID = "union-rsvp-dietary";

/** The ordinary questions a newly-created wedding starts with. They remain
 * fully editable in the form builder; stable ids keep answers attached when
 * the couple rewords them later. */
export function defaultPrimaryRsvpQuestions(): RsvpQuestion[] {
  return [
    {
      id: RSVP_DIETARY_QUESTION_ID,
      kind: "comment",
      title: {
        en: "Any dietary restrictions or allergies?",
        fr: "Des allergies ou un régime particulier ?",
      },
      required: false,
    },
    {
      id: "union-rsvp-note",
      kind: "comment",
      title: {
        en: "Anything else you would like us to know?",
        fr: "Autre chose que vous aimeriez nous signaler ?",
      },
      required: false,
    },
  ];
}
