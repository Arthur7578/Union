// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RsvpQuestion } from "@union/shared";
import { LocaleProvider } from "@/lib/i18n/client";

const harness = vi.hoisted(() => ({
  rpc: vi.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>(() => Promise.resolve({ data: null, error: null })),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({ rpc: harness.rpc }),
}));

import { CustomFormFlow } from "./CustomFormFlow";

afterEach(cleanup);

const questions: RsvpQuestion[] = [
  {
    id: "q-meal",
    kind: "single",
    title: { en: "Your main course?", fr: "Votre plat ?" },
    required: true,
    options: [
      { id: "o-fish", label: { en: "Fish", fr: "Poisson" } },
      { id: "o-veg", label: { en: "Vegetarian", fr: "Végétarien" } },
    ],
  },
  {
    id: "q-days",
    kind: "multi",
    title: { en: "Which days are you with us?" },
    required: false,
    options: [
      { id: "o-fri", label: { en: "Friday" } },
      { id: "o-sun", label: { en: "Sunday" } },
    ],
  },
];

const enter = () => fireEvent.keyDown(window, { key: "Enter" });

describe("CustomFormFlow", () => {
  it("asks each question in turn and sends the picked option ids", async () => {
    const onSaved = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <CustomFormFlow
          token="tok"
          isDemo={false}
          formId="form-1"
          heading="Dinner"
          questions={questions}
          initial={{}}
          onSaved={onSaved}
          onClose={() => {}}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText("2 questions")).toBeInTheDocument();
    enter();
    await screen.findByRole("heading", { name: "Your main course?" });

    // Required: OK alone doesn't move on.
    enter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Please answer this question.");

    fireEvent.keyDown(window, { key: "b" });
    await screen.findByRole("heading", { name: "Which days are you with us?" });
    expect(screen.getByText(/Choose as many as you like/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Friday/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sunday/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByRole("heading", { name: "Thank you!" });
    const answers = { "q-meal": "o-veg", "q-days": ["o-fri", "o-sun"] };
    expect(harness.rpc).toHaveBeenCalledWith("submit_form_response", {
      p_token: "tok",
      p_form_id: "form-1",
      p_answers: answers,
    });
    expect(onSaved).toHaveBeenCalledWith(answers);
  });
});
