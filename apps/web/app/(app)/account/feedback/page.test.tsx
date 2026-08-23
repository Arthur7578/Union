// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const harness = vi.hoisted(() => ({ showWidget: vi.fn() }));

vi.mock("@/lib/userjot", () => ({ ujShowWidget: harness.showWidget }));

vi.mock("@/components/BackHeader", () => ({
  BackHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import FeedbackPage from "./page";

afterEach(() => {
  cleanup();
  harness.showWidget.mockReset();
});

describe("Help & feedback page", () => {
  // With the SDK's floating launcher switched off, these rows are the only way
  // into the feedback panel — so each one has to reach it, on its own section.
  it("opens the panel on the section the reader picked", () => {
    render(<FeedbackPage />);

    for (const [label, section] of [
      [en.feedback.shareTitle, "feedback"],
      [en.feedback.roadmapTitle, "roadmap"],
      [en.feedback.updatesTitle, "updates"],
    ] as const) {
      harness.showWidget.mockClear();
      fireEvent.click(screen.getByText(label));
      expect(harness.showWidget).toHaveBeenCalledWith(section);
    }
  });
});
