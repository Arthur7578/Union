import { describe, expect, it } from "vitest";
import { looksLikeEmail, suggestEmailFix } from "./emailSuggest";

describe("suggestEmailFix", () => {
  it("fixes a near miss on a common provider", () => {
    expect(suggestEmailFix("julie@gmial.com")).toBe("julie@gmail.com");
    expect(suggestEmailFix("julie@hotmial.fr")).toBe("julie@hotmail.fr");
    expect(suggestEmailFix("Julie@GMAIL.CON")).toBe("julie@gmail.com");
  });

  it("leaves a correct address alone", () => {
    expect(suggestEmailFix("julie@gmail.com")).toBeNull();
    expect(suggestEmailFix("julie@orange.fr")).toBeNull();
  });

  it("does not rewrite domains it does not know", () => {
    expect(suggestEmailFix("julie@mycompany.io")).toBeNull();
    expect(suggestEmailFix("julie@studio-lumiere.fr")).toBeNull();
  });

  it("ignores text that is not an email", () => {
    expect(suggestEmailFix("julie")).toBeNull();
    expect(suggestEmailFix("@gmial.com")).toBeNull();
  });
});

describe("looksLikeEmail", () => {
  it("accepts an address and refuses the rest", () => {
    expect(looksLikeEmail(" julie@gmail.com ")).toBe(true);
    expect(looksLikeEmail("julie@gmail")).toBe(false);
    expect(looksLikeEmail("julie gmail.com")).toBe(false);
  });
});
