import { describe, expect, it } from "vitest";
import { smsBlockers } from "@/lib/sms";

const ok = {
  phone: "+33 6 12 34 56 78",
  phoneE164: "+33612345678",
  sender: "Union",
};

describe("smsBlockers", () => {
  it("has nothing to say when the guest can be texted", () => {
    expect(smsBlockers(ok)).toEqual([]);
  });

  it("asks for a number when there is none", () => {
    for (const phone of [null, undefined, "", "   "]) {
      expect(smsBlockers({ ...ok, phone, phoneE164: null })).toEqual([
        "no-phone",
      ]);
    }
  });

  it("asks for a country, not a number, when the number has no canonical form", () => {
    // Saved before countries were captured: the text is there, but the
    // database can't say which country it belongs to, so the route would
    // refuse it. Telling the organiser to "add a number" would be wrong.
    expect(
      smsBlockers({ ...ok, phone: "06 12 34 56 78", phoneE164: null }),
    ).toEqual(["no-country"]);
  });

  it("follows the database's value, not its own reading of the text", () => {
    // Text that looks international but the database did not canonicalise:
    // the route would refuse it, so the page must not offer it.
    expect(
      smsBlockers({ ...ok, phone: "+33 6 12 34 56 78", phoneE164: null }),
    ).toEqual(["no-country"]);
  });

  it("reports a missing sender alongside the guest's problem", () => {
    expect(smsBlockers({ ...ok, sender: "  " })).toEqual(["no-sender"]);
    expect(
      smsBlockers({ phone: null, phoneE164: null, sender: null }),
    ).toEqual(["no-phone", "no-sender"]);
    expect(
      smsBlockers({ phone: "0612345678", phoneE164: null, sender: "" }),
    ).toEqual(["no-country", "no-sender"]);
  });
});
