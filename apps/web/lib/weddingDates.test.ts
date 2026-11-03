import { describe, expect, it } from "vitest";
import { weddingDateText } from "./weddingDates";

describe("weddingDateText", () => {
  it("writes a single day, with no range", () => {
    expect(weddingDateText("2027-06-12", null, "fr")).toEqual({
      short: "12 juin 2027",
      spoken: "le 12 juin 2027",
      days: 1,
    });
    expect(weddingDateText("2027-06-12", null, "en")).toEqual({
      short: "June 12, 2027",
      spoken: "on June 12, 2027",
      days: 1,
    });
  });

  it("writes a range inside one month", () => {
    expect(weddingDateText("2027-06-11", "2027-06-13", "fr")).toEqual({
      short: "11 — 13 juin 2027",
      spoken: "du 11 au 13 juin 2027",
      days: 3,
    });
    expect(weddingDateText("2027-06-11", "2027-06-13", "en")).toEqual({
      short: "June 11 — 13, 2027",
      spoken: "from June 11 to 13, 2027",
      days: 3,
    });
  });

  it("repeats the month, then the year, only when the range crosses them", () => {
    expect(weddingDateText("2027-06-30", "2027-07-02", "fr")?.short).toBe("30 juin — 2 juillet 2027");
    expect(weddingDateText("2027-06-30", "2027-07-02", "en")?.short).toBe("June 30 — July 2, 2027");
    expect(weddingDateText("2027-12-30", "2028-01-02", "fr")?.spoken).toBe(
      "du 30 décembre 2027 au 2 janvier 2028",
    );
    expect(weddingDateText("2027-12-30", "2028-01-02", "en")?.short).toBe(
      "December 30, 2027 — January 2, 2028",
    );
  });

  it("writes the first of the month as 1er in French", () => {
    expect(weddingDateText("2027-06-01", "2027-06-03", "fr")?.short).toBe("1er — 3 juin 2027");
    expect(weddingDateText("2027-06-01", null, "fr")?.short).toBe("1er juin 2027");
  });

  it("treats an end that is not after the start as a single day", () => {
    expect(weddingDateText("2027-06-12", "2027-06-12", "fr")?.days).toBe(1);
    expect(weddingDateText("2027-06-12", "2027-06-10", "fr")?.short).toBe("12 juin 2027");
    expect(weddingDateText("2027-06-12", "nope", "fr")?.short).toBe("12 juin 2027");
  });

  it("gives nothing without a valid start", () => {
    expect(weddingDateText(null, "2027-06-13", "fr")).toBeNull();
    expect(weddingDateText("2027-02-31", null, "fr")).toBeNull();
  });
});
