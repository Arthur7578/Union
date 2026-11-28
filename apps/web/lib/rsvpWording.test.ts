import { describe, expect, it } from "vitest";
import { getDictionary } from "./i18n";
import { rsvpWording } from "./i18n/text";

const defaults = getDictionary("en").formDefaults.rsvp.primary;

describe("rsvpWording", () => {
  it("falls back to Union's default for every slot when the couple wrote nothing", () => {
    expect(rsvpWording(null, "en")).toEqual({
      title: defaults.title,
      subtitle: defaults.subtitle,
      labelAttending: defaults.labelAttending,
      labelMaybe: defaults.labelMaybe,
      labelDeclined: defaults.labelDeclined,
    });
  });

  it("uses the couple's own wording for the slots they filled in, and only those", () => {
    const wording = rsvpWording({ label_maybe: { en: "Hoping to!" } }, "en");
    expect(wording.labelMaybe).toBe("Hoping to!");
    expect(wording.labelAttending).toBe(defaults.labelAttending);
    expect(wording.labelDeclined).toBe(defaults.labelDeclined);
  });

  it("defaults to the guest's own language when the couple wrote nothing", () => {
    const fr = getDictionary("fr").formDefaults.rsvp.primary;
    expect(rsvpWording(null, "fr").labelMaybe).toBe(fr.labelMaybe);
  });

  it("prefers the couple's copy in another language over a default in the guest's", () => {
    // The couple wrote only English: a French guest sees that rather than a
    // system default, the same fallback order every other screen uses.
    expect(rsvpWording({ label_maybe: { en: "Hoping to!" } }, "fr").labelMaybe).toBe("Hoping to!");
  });
});
