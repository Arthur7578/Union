import { describe, expect, it } from "vitest";
import { applyTranslations, collectTranslatable } from "./fairePartTranslation";

describe("collectTranslatable", () => {
  it("queues only what the couple wrote in the source language", () => {
    const slots = collectTranslatable(
      { greeting: { fr: "Cher {{guest_first_name}}," }, closing: { en: "Love," } },
      "fr",
      "en",
    );
    expect(slots).toEqual([{ id: "greeting", text: "Cher {{guest_first_name}}," }]);
  });

  it("has nothing to do when the couple changed nothing", () => {
    expect(collectTranslatable({}, "fr", "en")).toEqual([]);
  });

  it("leaves wording the couple typed in the target language alone", () => {
    const slots = collectTranslatable({ closing: { fr: "Bises,", en: "Love," } }, "fr", "en");
    expect(slots.map((s) => s.id)).not.toContain("closing");
  });

  it("redoes an earlier machine translation", () => {
    const copy = { closing: { fr: "Bises,", en: "Kisses,", $auto: ["en"] } };
    expect(collectTranslatable(copy, "fr", "en").map((s) => s.id)).toContain("closing");
  });
});

describe("applyTranslations", () => {
  it("stores the translation flagged for review, keeping the source", () => {
    const next = applyTranslations({ closing: { fr: "Bises," } }, { closing: " Kisses, " }, "fr", "en");
    expect(next.closing).toEqual({ fr: "Bises,", en: "Kisses,", $auto: ["en"] });
  });

  it("ignores ids that are not slots and empty answers", () => {
    const next = applyTranslations({}, { nope: "x", closing: "  " }, "fr", "en");
    expect(next).toEqual({});
  });
});
