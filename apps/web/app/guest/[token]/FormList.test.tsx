// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { FormList } from "./FormList";

afterEach(cleanup);

describe("FormList", () => {
  it("shows every form the same way: its state in words and one action", () => {
    const openRsvp = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <FormList
          items={[
            { key: "rsvp", title: "Attendance RSVP", state: "todo", onOpen: openRsvp },
            { key: "shuttle", title: "Shuttle", meta: "1 question", state: "done", onOpen: () => {} },
            { key: "tables", title: "Table neighbours", state: "soon" },
            { key: "check", title: "Still coming?", state: "todo", onOpen: () => {}, actionLabel: "Confirm" },
          ]}
        />
      </LocaleProvider>,
    );

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);

    expect(within(rows[0]).getByText("To do")).toBeInTheDocument();
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Reply" }));
    expect(openRsvp).toHaveBeenCalled();

    expect(within(rows[1]).getByText("Done")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("button", { name: "Edit" })).toBeInTheDocument();

    // Not open yet: said so, and nothing to press.
    expect(within(rows[2]).getByText("Coming soon")).toBeInTheDocument();
    expect(within(rows[2]).queryByRole("button")).not.toBeInTheDocument();

    expect(within(rows[3]).getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });
});
