import { describe, expect, it } from "vitest";
import {
  RSVP_FIELD_KEYS,
  askedRsvpFields,
  resolveRsvpFields,
  toStoredRsvpFields,
} from "@union/shared";

describe("what the RSVP block asks for", () => {
  it("asks everything when the couple has changed nothing", () => {
    // '{}' is what every RSVP form written before the column existed holds,
    // so this is the "nothing changed, nothing lost" case.
    expect(resolveRsvpFields({})).toEqual({
      dietary: true,
      companion_dietary: true,
      note: true,
    });
  });

  it("drops only the fields explicitly set to false", () => {
    expect(
      resolveRsvpFields({ dietary: false, companion_dietary: false }),
    ).toEqual({
      dietary: false,
      companion_dietary: false,
      note: true,
    });
  });

  it("treats a stored true as asked, same as an absent key", () => {
    expect(resolveRsvpFields({ dietary: true, note: false })).toEqual({
      dietary: true,
      companion_dietary: true,
      note: false,
    });
  });

  it("keeps asking on a malformed value", () => {
    // A bad row must never quietly stop collecting a guest's allergies, so
    // anything that isn't an explicit false for a known key leaves the field
    // asked for.
    const everything = {
      dietary: true,
      companion_dietary: true,
      note: true,
    };
    expect(resolveRsvpFields(null)).toEqual(everything);
    expect(resolveRsvpFields(undefined)).toEqual(everything);
    expect(resolveRsvpFields("nope")).toEqual(everything);
    expect(resolveRsvpFields([false])).toEqual(everything);
    expect(resolveRsvpFields({ dietary: "no" })).toEqual(everything);
    expect(resolveRsvpFields({ unknown_field: false })).toEqual(everything);
  });

  it("stores only the off decisions", () => {
    // What lets a field added to the block later default to asked rather
    // than inheriting today's snapshot of the defaults.
    expect(
      toStoredRsvpFields({
        dietary: false,
        companion_dietary: false,
        note: true,
      }),
    ).toEqual({ dietary: false, companion_dietary: false });
    expect(
      toStoredRsvpFields({
        dietary: true,
        companion_dietary: true,
        note: true,
      }),
    ).toEqual({});
  });

  it("round-trips through storage", () => {
    const chosen = {
      dietary: true,
      companion_dietary: false,
      note: false,
    };
    expect(resolveRsvpFields(toStoredRsvpFields(chosen))).toEqual(chosen);
  });

  it("lists the asked-for fields in the order guests meet them", () => {
    expect(askedRsvpFields({})).toEqual([...RSVP_FIELD_KEYS]);
    expect(askedRsvpFields({ companion_dietary: false })).toEqual([
      "dietary",
      "note",
    ]);
    expect(
      askedRsvpFields({ dietary: false, companion_dietary: false, note: false }),
    ).toEqual([]);
  });
});
