import { describe, expect, it } from "vitest";
import { defaultPrimaryRsvpQuestions } from "./rsvpQuestions";

describe("default RSVP questions", () => {
  it("starts a new wedding with editable dietary and note questions", () => {
    expect(defaultPrimaryRsvpQuestions()).toMatchObject([
      { id: "union-rsvp-dietary", kind: "comment", required: false },
      { id: "union-rsvp-note", kind: "comment", required: false },
    ]);
  });

  it("returns a fresh question tree for every wedding", () => {
    const first = defaultPrimaryRsvpQuestions();
    first[0].title.en = "Changed";

    expect(defaultPrimaryRsvpQuestions()[0].title.en).toBe(
      "Any dietary restrictions or allergies?",
    );
  });
});
