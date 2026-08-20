import { describe, expect, it } from "vitest";
import {
  isAutoTranslated,
  normalizeQuestions,
  resolveText,
  setAutoTextForLocale,
  setTextForLocale,
  textForLocale,
  toLocalizedText,
  type RsvpQuestion,
} from "@union/shared";
import { coupleText, coupleTextOr } from "./i18n/text";
import {
  applyTranslations,
  collectTranslatable,
  type FormCopyDraft,
} from "./formTranslation";

describe("resolveText", () => {
  it("prefers the reader's own language", () => {
    const value = { en: "Your presence", fr: "Votre présence" };
    expect(resolveText(value, "fr", ["en", "fr"])).toBe("Votre présence");
    expect(resolveText(value, "en", ["en", "fr"])).toBe("Your presence");
  });

  it("falls back rather than showing a blank headline", () => {
    // The couple wrote English only — a French guest still gets a headline.
    expect(resolveText({ en: "Your presence" }, "fr", ["en", "fr"])).toBe(
      "Your presence",
    );
    // ...and vice versa, even though English is the app's default locale.
    expect(resolveText({ fr: "Votre présence" }, "en", ["en", "fr"])).toBe(
      "Votre présence",
    );
  });

  it("treats whitespace-only text as unwritten so the caller can default", () => {
    expect(resolveText({ en: "   ", fr: "" }, "fr", ["en", "fr"])).toBeUndefined();
  });

  it("reads copy written before localization existed", () => {
    // Pre-migration rows hold a bare string; a deploy must not outrun its
    // migration and blank out a live invitation.
    expect(resolveText("Your presence", "fr", ["en", "fr"])).toBe("Your presence");
  });

  it("never renders the auto-translation marker as copy", () => {
    expect(resolveText({ $auto: ["fr"] }, "fr", ["en", "fr"])).toBeUndefined();
    expect(resolveText({ $auto: ["fr"], en: "Hello" }, "de", [])).toBe("Hello");
  });
});

describe("coupleText", () => {
  it("falls back to the system default only when nothing was written", () => {
    expect(coupleTextOr({ fr: "Votre présence" }, "en", "Attendance RSVP")).toBe(
      "Votre présence",
    );
    expect(coupleTextOr(undefined, "fr", "RSVP de Présence")).toBe(
      "RSVP de Présence",
    );
    expect(coupleText({}, "fr")).toBeUndefined();
  });
});

describe("textForLocale / setTextForLocale", () => {
  it("reads one language exactly, with no fallback", () => {
    // The builder must show an empty French field as empty — echoing the
    // English into it would get saved as French on the next keystroke.
    const value = { en: "Your presence" };
    expect(textForLocale(value, "fr")).toBe("");
    expect(textForLocale(value, "en")).toBe("Your presence");
  });

  it("writes one language without disturbing the others", () => {
    const next = setTextForLocale({ en: "Your presence" }, "fr", "Votre présence");
    expect(next).toEqual({ en: "Your presence", fr: "Votre présence" });
  });

  it("clears a language when its text is emptied", () => {
    const next = setTextForLocale({ en: "Hi", fr: "Salut" }, "fr", "  ");
    expect(next).toEqual({ en: "Hi" });
  });

  it("drops the auto flag once a person edits that language", () => {
    const auto = setAutoTextForLocale({ en: "Hi" }, "fr", "Salut");
    expect(isAutoTranslated(auto, "fr")).toBe(true);
    const edited = setTextForLocale(auto, "fr", "Coucou");
    expect(isAutoTranslated(edited, "fr")).toBe(false);
    expect(edited.en).toBe("Hi");
  });

  it("keeps other languages' auto flags when one is edited", () => {
    let value = setAutoTextForLocale({ en: "Hi" }, "fr", "Salut");
    value = setAutoTextForLocale(value, "de", "Hallo");
    const edited = setTextForLocale(value, "fr", "Coucou");
    expect(isAutoTranslated(edited, "de")).toBe(true);
    expect(isAutoTranslated(edited, "fr")).toBe(false);
  });
});

describe("toLocalizedText", () => {
  it("files a legacy string under the assumed source language", () => {
    expect(toLocalizedText("Your presence", "en")).toEqual({
      en: "Your presence",
    });
  });

  it("ignores keys that aren't languages", () => {
    expect(toLocalizedText({ en: "Hi", "not a locale": "x" }, "en")).toEqual({
      en: "Hi",
    });
  });
});

describe("normalizeQuestions", () => {
  it("upgrades pre-migration questions to localized titles and option ids", () => {
    const questions = normalizeQuestions(
      [
        {
          id: "q1",
          kind: "single",
          title: "Which meal?",
          required: true,
          options: ["Meat", "Fish"],
        },
      ],
      "en",
    );
    expect(questions).toEqual([
      {
        id: "q1",
        kind: "single",
        title: { en: "Which meal?" },
        required: true,
        options: [
          // Ids match the migration's own scheme, so an answer saved before
          // the migration still points at the right choice after it.
          { id: "o0", label: { en: "Meat" } },
          { id: "o1", label: { en: "Fish" } },
        ],
      },
    ]);
  });

  it("leaves already-localized questions alone", () => {
    const input = [
      {
        id: "q1",
        kind: "multi",
        title: { en: "Which events?", fr: "Quels événements ?" },
        required: false,
        options: [{ id: "abc", label: { en: "Dinner", fr: "Dîner" } }],
      },
    ];
    expect(normalizeQuestions(input, "en")).toEqual(input);
  });

  it("drops entries too malformed to render, keeping the rest", () => {
    const questions = normalizeQuestions(
      [null, { kind: "short" }, { id: "q2", kind: "short", title: "Ok" }],
      "en",
    );
    expect(questions.map((q) => q.id)).toEqual(["q2"]);
  });

  it("keeps text-answer questions free of an options list", () => {
    const [q] = normalizeQuestions(
      [{ id: "q1", kind: "comment", title: "Anything else?", options: ["x"] }],
      "en",
    );
    expect(q.options).toBeUndefined();
  });
});

function draft(questions: RsvpQuestion[] = []): FormCopyDraft {
  return {
    rsvpCopy: {
      title: { en: "Your presence" },
      label_attending: { en: "Count me in" },
    },
    guestCopy: {},
    questions,
  };
}

describe("collectTranslatable", () => {
  it("queues every slot the target language is missing", () => {
    const slots = collectTranslatable(
      draft([
        {
          id: "q1",
          kind: "single",
          title: { en: "Which meal?" },
          required: true,
          options: [{ id: "o0", label: { en: "Fish" } }],
        },
      ]),
      "en",
      "fr",
    );
    expect(slots).toEqual([
      { id: "rsvp.title", text: "Your presence" },
      { id: "rsvp.label_attending", text: "Count me in" },
      { id: "question.q1.title", text: "Which meal?" },
      { id: "question.q1.option.o0", text: "Fish" },
    ]);
  });

  it("never overwrites wording a person typed in the target language", () => {
    const d = draft();
    d.rsvpCopy.title = { en: "Your presence", fr: "Votre présence à nous" };
    const ids = collectTranslatable(d, "en", "fr").map((s) => s.id);
    expect(ids).not.toContain("rsvp.title");
  });

  it("does refresh a stale machine translation", () => {
    const d = draft();
    d.rsvpCopy.title = setAutoTextForLocale(
      { en: "Your presence" },
      "fr",
      "Votre présence",
    );
    const ids = collectTranslatable(d, "en", "fr").map((s) => s.id);
    expect(ids).toContain("rsvp.title");
  });

  it("skips slots with nothing written in the source language", () => {
    const ids = collectTranslatable(
      { rsvpCopy: { title: { fr: "Votre présence" } }, guestCopy: {}, questions: [] },
      "en",
      "fr",
    ).map((s) => s.id);
    expect(ids).toEqual([]);
  });
});

describe("applyTranslations", () => {
  it("lands each translation in its own slot, flagged for review", () => {
    const next = applyTranslations(
      draft([
        {
          id: "q1",
          kind: "single",
          title: { en: "Which meal?" },
          required: true,
          options: [{ id: "o0", label: { en: "Fish" } }],
        },
      ]),
      {
        "rsvp.title": "Votre présence",
        "question.q1.title": "Quel plat ?",
        "question.q1.option.o0": "Poisson",
      },
      "en",
      "fr",
    );
    expect(next.rsvpCopy.title).toEqual({
      en: "Your presence",
      fr: "Votre présence",
      $auto: ["fr"],
    });
    expect(next.questions[0].title.fr).toBe("Quel plat ?");
    expect(next.questions[0].options?.[0]).toEqual({
      id: "o0",
      label: { en: "Fish", fr: "Poisson", $auto: ["fr"] },
    });
    // Untranslated slots are left exactly as they were.
    expect(next.rsvpCopy.label_attending).toEqual({ en: "Count me in" });
  });

  it("ignores ids that no longer match anything in the form", () => {
    const next = applyTranslations(
      draft(),
      { "question.gone.title": "Fantôme", "rsvp.title": "Votre présence" },
      "en",
      "fr",
    );
    expect(next.questions).toEqual([]);
    expect(next.rsvpCopy.title?.fr).toBe("Votre présence");
  });

  it("ignores blank translations rather than clearing the slot", () => {
    const next = applyTranslations(draft(), { "rsvp.title": "   " }, "en", "fr");
    expect(next.rsvpCopy.title).toEqual({ en: "Your presence" });
  });
});
