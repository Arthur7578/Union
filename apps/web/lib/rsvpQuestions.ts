import type { RsvpQuestion } from "@union/shared";

/** The ordinary questions a newly-created wedding starts with. They remain
 * fully editable in the form builder; stable ids keep answers attached when
 * the couple rewords them later. */
export function defaultPrimaryRsvpQuestions(): RsvpQuestion[] {
  return [
    {
      id: "union-rsvp-dietary",
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
