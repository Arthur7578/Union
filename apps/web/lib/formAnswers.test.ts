import { describe, expect, it } from "vitest";
import type { RsvpQuestion } from "@union/shared";
import {
  answeredCount,
  hasAnyAnswer,
  missingRequired,
  readableAnswers,
} from "@/lib/formAnswers";

const MEAL: RsvpQuestion = {
  id: "q-meal",
  kind: "single",
  title: { en: "Meal preference", fr: "Choix du plat" },
  required: true,
  options: [
    { id: "o-fish", label: { en: "Fish", fr: "Poisson" } },
    { id: "o-veg", label: { en: "Vegetarian", fr: "Végétarien" } },
  ],
};

const EXTRAS: RsvpQuestion = {
  id: "q-extras",
  kind: "multi",
  title: { en: "Anything else?" },
  required: false,
  options: [
    { id: "o-nuts", label: { en: "No nuts" } },
    { id: "o-dairy", label: { en: "No dairy" } },
  ],
};

const SONG: RsvpQuestion = {
  id: "q-song",
  kind: "short",
  title: { en: "A song you'd love to hear" },
  required: false,
};

describe("reading form answers back for the organiser", () => {
  it("resolves a chosen option id to its label in the reader's language", () => {
    const rows = readableAnswers([MEAL], { "q-meal": "o-veg" }, "fr");
    expect(rows).toEqual([
      {
        key: "q-meal",
        question: "Choix du plat",
        answer: "Végétarien",
        orphaned: false,
      },
    ]);
  });

  it("joins a multi answer and keeps free text as typed", () => {
    const rows = readableAnswers(
      [EXTRAS, SONG],
      { "q-extras": ["o-dairy", "o-nuts"], "q-song": " Blue Monday " },
      "en",
    );
    expect(rows.map((r) => r.answer)).toEqual([
      "No dairy, No nuts",
      "Blue Monday",
    ]);
  });

  it("keeps an unanswered question in the list rather than hiding it", () => {
    // "They skipped the allergies question" is information; an absent row
    // reads as a question that was never asked.
    const rows = readableAnswers([MEAL, SONG], { "q-meal": "o-fish" }, "en");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ key: "q-song", answer: null });
    expect(answeredCount(rows)).toBe(1);
  });

  it("shows an option id nobody recognises rather than dropping the answer", () => {
    // The couple reworded their options after this guest replied. Something
    // was chosen, and showing nothing would be the worse lie.
    const rows = readableAnswers([MEAL], { "q-meal": "o-gone" }, "en");
    expect(rows[0].answer).toBe("o-gone");
  });

  it("keeps an answer whose question has since been deleted, flagged", () => {
    const rows = readableAnswers([MEAL], { "q-removed": "Gluten free" }, "en");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      key: "q-removed",
      answer: "Gluten free",
      orphaned: true,
    });
    // An orphan isn't progress against the current form's questions.
    expect(answeredCount(rows)).toBe(0);
  });

  it("treats a blank or missing response as no answers at all", () => {
    expect(readableAnswers([MEAL], null, "en")[0].answer).toBeNull();
    expect(readableAnswers([MEAL], { "q-meal": "  " }, "en")[0].answer).toBeNull();
    expect(readableAnswers([EXTRAS], { "q-extras": [] }, "en")[0].answer).toBeNull();
    expect(readableAnswers([], null, "en")).toEqual([]);
  });
});

describe("deciding whether a person has been answered for", () => {
  it("is false for nothing, blanks and empty lists", () => {
    // What keeps a child nobody filled in from being submitted as a row of
    // blanks that reads like a considered "no preference".
    expect(hasAnyAnswer(undefined)).toBe(false);
    expect(hasAnyAnswer(null)).toBe(false);
    expect(hasAnyAnswer({})).toBe(false);
    expect(hasAnyAnswer({ "q-song": "   " })).toBe(false);
    expect(hasAnyAnswer({ "q-extras": [] })).toBe(false);
    expect(hasAnyAnswer({ "q-extras": ["", "  "] })).toBe(false);
  });

  it("is true as soon as anything is filled in", () => {
    expect(hasAnyAnswer({ "q-meal": "o-fish" })).toBe(true);
    expect(hasAnyAnswer({ "q-extras": ["o-nuts"] })).toBe(true);
    expect(hasAnyAnswer({ "q-song": "Blue Monday" })).toBe(true);
  });
});

describe("required questions still to answer", () => {
  it("names what is missing, and only what is required", () => {
    expect(missingRequired([MEAL, SONG], {})).toEqual([MEAL]);
    expect(missingRequired([MEAL, SONG], { "q-meal": "o-fish" })).toEqual([]);
    expect(missingRequired([SONG], {})).toEqual([]);
  });

  it("counts a blank or empty list as unanswered", () => {
    const requiredMulti = { ...EXTRAS, required: true };
    expect(missingRequired([MEAL], { "q-meal": " " })).toEqual([MEAL]);
    expect(missingRequired([requiredMulti], { "q-extras": [] })).toEqual([
      requiredMulti,
    ]);
    expect(missingRequired([requiredMulti], { "q-extras": ["o-nuts"] })).toEqual(
      [],
    );
  });
});
