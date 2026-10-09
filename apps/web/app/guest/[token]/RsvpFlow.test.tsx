// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";

/**
 * The RSVP asked one question at a time: which questions a guest meets
 * depends on their answers, and nothing reaches the database before the
 * last step sends it all.
 */

const harness = vi.hoisted(() => ({
  rpc: vi.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>(() => Promise.resolve({ data: null, error: null as unknown })),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({ rpc: harness.rpc }),
}));

import { RsvpFlow, type Companion, type RsvpReply } from "./RsvpFlow";
import type { ReplyEmail } from "./ReplyEmailField";

const guinevere: Companion = {
  id: "c-1",
  first_name: "Guinevere",
  last_name: "Pendragon",
  age_years: 28,
  relationship: "partner_of",
  rsvp_status: "pending",
  dietary_notes: null,
};

const pending: RsvpReply = { status: "pending", dietary: "", message: "", companions: {} };

function open(
  opts: {
    companions?: Companion[];
    onSaved?: (r: RsvpReply) => void;
    onClose?: () => void;
    replyEmail?: ReplyEmail;
  } = {},
) {
  return render(
    <LocaleProvider initialLocale="en">
      <RsvpFlow
        token="tok"
        isDemo={false}
        title="Attendance RSVP"
        subtitle="Let us know."
        labelAttending="Attending"
        labelDeclined="Declined"
        guestFirstName="Arthur"
        coupleNames="Maya & Daniel"
        replyEmail={opts.replyEmail}
        initial={pending}
        companions={opts.companions ?? []}
        canAddPartner={false}
        canAddKids={false}
        onCompanionAdded={() => {}}
        onSaved={opts.onSaved ?? (() => {})}
        onClose={opts.onClose ?? (() => {})}
      />
    </LocaleProvider>,
  );
}

const enter = () => fireEvent.keyDown(window, { key: "Enter" });
/** Waits for a step, then for its effects (the choices' letter keys) to be
 *  wired: a real guest can't type within that instant, a test can. */
const question = async (text: string) => {
  const heading = await screen.findByRole("heading", { name: new RegExp(text) });
  await act(async () => {});
  return heading;
};

// Reduced motion: steps change at once instead of after their exit
// animation, which keeps these multi-step tests well inside their timeout.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  harness.rpc.mockClear();
  harness.rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
});
afterEach(cleanup);

describe("RsvpFlow", () => {
  it("opens on the couple's wording, then asks whether the guest is coming", async () => {
    open();
    expect(screen.getByRole("heading", { name: "Attendance RSVP" })).toBeInTheDocument();
    enter();
    expect(await question("Arthur, will you join us\\?")).toBeInTheDocument();
  });

  it("won't move on until the guest has answered", async () => {
    open();
    enter();
    await question("will you join us");
    enter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Please answer this question.");
  });

  it("goes straight to the note for a guest who declines, and sends it", async () => {
    const onSaved = vi.fn();
    open({ companions: [guinevere], onSaved });
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" }); // B = Declined

    const note = await question("A word for Maya & Daniel\\?");
    expect(note).toBeInTheDocument();
    expect(screen.queryByText(/dietary/)).not.toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "So sorry!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await question("Thank you, Arthur")).toBeInTheDocument();
    expect(harness.rpc).toHaveBeenCalledWith("submit_rsvp", {
      p_token: "tok",
      p_status: "declined",
      p_dietary_notes: undefined,
      p_message: "So sorry!",
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: "declined", message: "So sorry!" }));
  });

  it("asks a coming guest about their diet and each companion", async () => {
    open({ companions: [guinevere] });
    enter();
    await question("will you join us");
    fireEvent.click(screen.getByRole("button", { name: /Attending/ }));

    await question("Any allergies or dietary needs\\?");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Vegetarian" } });
    enter();

    await question("Will Guinevere join us\\?");
    fireEvent.keyDown(window, { key: "a" });
    await question("dietary needs for Guinevere");
    enter();
    await question("A word for");
    enter();

    await question("See you soon, Arthur!");
    expect(harness.rpc).toHaveBeenCalledWith("submit_rsvp", expect.objectContaining({
      p_status: "attending",
      p_dietary_notes: "Vegetarian",
    }));
    expect(harness.rpc).toHaveBeenCalledWith("submit_companion_rsvp", {
      p_token: "tok",
      p_companion_guest_id: "c-1",
      p_status: "attending",
      p_dietary_notes: undefined,
    });
  });

  it("keeps the guest on the last step, with a message, when sending fails", async () => {
    harness.rpc.mockImplementation(() => Promise.resolve({ data: null, error: { message: "" } }));
    open();
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });
    await question("A word for");
    enter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("heading", { name: /A word for/ })).toBeInTheDocument();
  });

  it("does not move on when Shift+Enter breaks a line in the note", async () => {
    open();
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });
    await question("A word for");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true });
    await new Promise((r) => setTimeout(r, 400));
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("closes from the last screen", async () => {
    const onClose = vi.fn();
    open({ onClose });
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });
    await question("A word for");
    enter();
    await question("Thank you, Arthur");
    fireEvent.click(screen.getByRole("button", { name: "Back to the invitation" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("asks a guest the couple has no email for, and keeps them there until it's saved", async () => {
    const save = vi.fn(() => Promise.resolve(false));
    const replyEmail: ReplyEmail = {
      show: true,
      required: true,
      email: "",
      setEmail: () => {},
      error: null,
      save,
    };
    open({ replyEmail });
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });

    await question("Your email");
    expect(screen.getByText("So Maya & Daniel can send you the practical details.")).toBeInTheDocument();
    enter();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("heading", { name: "Your email" })).toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();

    save.mockImplementation(() => Promise.resolve(true));
    enter();
    expect(await question("A word for Maya & Daniel")).toBeInTheDocument();
  });
});
