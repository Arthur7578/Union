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

import type { RsvpQuestion } from "@union/shared";
import { defaultPrimaryRsvpQuestions } from "@/lib/rsvpQuestions";
import { RsvpFlow, type Companion, type RsvpAnswers, type RsvpReply } from "./RsvpFlow";
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

const pending: RsvpReply = { status: "pending", companions: {} };

function open(
  opts: {
    companions?: Companion[];
    questions?: RsvpQuestion[];
    formId?: string | null;
    initialAnswers?: RsvpAnswers;
    onSaved?: (r: RsvpReply, answers: RsvpAnswers) => void;
    onClose?: () => void;
    replyEmail?: ReplyEmail;
    /** Whether the wedding offers "maybe" (off unless a test says so). */
    allowMaybe?: boolean;
    labelMaybe?: string;
    initial?: RsvpReply;
  } = {},
) {
  return render(
    <LocaleProvider initialLocale="en">
      <RsvpFlow
        token="tok"
        isDemo={false}
        formId={opts.formId === undefined ? "form-1" : opts.formId}
        questions={opts.questions ?? defaultPrimaryRsvpQuestions()}
        guestId="g-1"
        title="Attendance RSVP"
        subtitle="Let us know."
        labelAttending="Attending"
        labelMaybe={opts.labelMaybe ?? "Not sure yet"}
        labelDeclined="Declined"
        allowMaybe={opts.allowMaybe ?? false}
        guestFirstName="Arthur"
        coupleNames="Maya & Daniel"
        replyEmail={opts.replyEmail}
        initial={opts.initial ?? pending}
        initialAnswers={opts.initialAnswers ?? {}}
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

  it("asks a guest who declines the couple's questions, but not about their diet", async () => {
    const onSaved = vi.fn();
    open({ companions: [guinevere], onSaved });
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" }); // B = Declined

    const note = await question("Anything else you would like us to know\\?");
    expect(note).toBeInTheDocument();
    expect(screen.queryByText(/dietary/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Guinevere/)).not.toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "So sorry!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await question("Thank you, Arthur")).toBeInTheDocument();
    expect(harness.rpc).toHaveBeenCalledTimes(1);
    expect(harness.rpc).toHaveBeenCalledWith("submit_rsvp_response", {
      p_token: "tok",
      p_form_id: "form-1",
      p_status: "declined",
      p_companions: [],
      p_answers: [{ guest_id: "g-1", answers: { "union-rsvp-note": "So sorry!" } }],
    });
    expect(onSaved).toHaveBeenCalledWith(
      { status: "declined", companions: {} },
      { "g-1": { "union-rsvp-note": "So sorry!" } },
    );
  });

  it("asks the couple's questions for the guest and each companion who comes, and sends it all at once", async () => {
    open({ companions: [guinevere] });
    enter();
    await question("will you join us");
    fireEvent.click(screen.getByRole("button", { name: /Attending/ }));

    await question("Any dietary restrictions or allergies\\?");
    expect(screen.getByText(/For you/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Vegetarian" } });
    enter();
    await question("Anything else");
    enter();

    await question("Will Guinevere join us\\?");
    fireEvent.keyDown(window, { key: "a" });
    await question("Any dietary restrictions");
    expect(screen.getByText(/For Guinevere/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "No nuts" } });
    enter();
    await question("Anything else");
    enter();

    await question("See you soon, Arthur!");
    expect(harness.rpc).toHaveBeenCalledTimes(1);
    expect(harness.rpc).toHaveBeenCalledWith("submit_rsvp_response", {
      p_token: "tok",
      p_form_id: "form-1",
      p_status: "attending",
      p_companions: [{ guest_id: "c-1", status: "attending" }],
      p_answers: [
        { guest_id: "g-1", answers: { "union-rsvp-dietary": "Vegetarian" } },
        { guest_id: "c-1", answers: { "union-rsvp-dietary": "No nuts" } },
      ],
    });
  });

  it("reopens on the answers already sent", async () => {
    open({ initialAnswers: { "g-1": { "union-rsvp-dietary": "Vegan" } } });
    enter();
    await question("will you join us");
    fireEvent.click(screen.getByRole("button", { name: /Attending/ }));
    await question("Any dietary restrictions");
    expect(screen.getByRole("textbox")).toHaveValue("Vegan");
  });

  it("won't send until a question the couple made required is answered", async () => {
    const questions: RsvpQuestion[] = [
      {
        id: "meal",
        kind: "single",
        title: { en: "Fish or meat?" },
        required: true,
        options: [
          { id: "fish", label: { en: "Fish" } },
          { id: "meat", label: { en: "Meat" } },
        ],
      },
    ];
    open({ questions });
    enter();
    await question("will you join us");
    fireEvent.click(screen.getByRole("button", { name: /Attending/ }));
    await question("Fish or meat\\?");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please answer this question.");
    expect(harness.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Meat/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await question("See you soon, Arthur!");
    expect(harness.rpc).toHaveBeenCalledWith(
      "submit_rsvp_response",
      expect.objectContaining({ p_answers: [{ guest_id: "g-1", answers: { meal: "meat" } }] }),
    );
  });

  it("sends the answer alone when the couple asks no questions", async () => {
    open({ questions: [] });
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });
    expect(await question("Thank you, Arthur")).toBeInTheDocument();
    expect(harness.rpc).toHaveBeenCalledWith(
      "submit_rsvp_response",
      expect.objectContaining({ p_status: "declined", p_answers: [] }),
    );
  });

  it("still sends the reply, without answers, when the RSVP form couldn't be loaded", async () => {
    open({ formId: null });
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });
    await question("Anything else");
    enter();
    await question("Thank you, Arthur");
    expect(harness.rpc).toHaveBeenCalledWith(
      "submit_rsvp_response",
      expect.objectContaining({ p_form_id: null, p_answers: [] }),
    );
  });

  it("keeps the guest on the last step, with a message, when sending fails", async () => {
    harness.rpc.mockImplementation(() => Promise.resolve({ data: null, error: { message: "" } }));
    open();
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });
    await question("Anything else");
    enter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("heading", { name: /Anything else/ })).toBeInTheDocument();
  });

  it("does not move on when Shift+Enter breaks a line in the note", async () => {
    open();
    enter();
    await question("will you join us");
    fireEvent.keyDown(window, { key: "b" });
    await question("Anything else");
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
    await question("Anything else");
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

    // Asked first, before the answer itself.
    await question("Your email");
    expect(screen.getByText("So Maya & Daniel can send you the practical details.")).toBeInTheDocument();
    enter();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("heading", { name: "Your email" })).toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();

    save.mockImplementation(() => Promise.resolve(true));
    enter();
    expect(await question("Arthur, will you join us\\?")).toBeInTheDocument();
  });

  it("starts at the first question when opened from the faire-part", async () => {
    render(
      <LocaleProvider initialLocale="en">
        <RsvpFlow
          token="tok"
          isDemo={false}
          title="Attendance RSVP"
          subtitle="Let us know."
          labelAttending="Attending"
          labelMaybe="Not sure yet"
          labelDeclined="Declined"
          allowMaybe={false}
          guestFirstName="Arthur"
          coupleNames="Maya & Daniel"
          skipIntro
          formId="form-1"
          questions={[]}
          guestId="g-1"
          initial={pending}
          initialAnswers={{}}
          companions={[]}
          canAddPartner={false}
          canAddKids={false}
          onCompanionAdded={() => {}}
          onSaved={() => {}}
          onClose={() => {}}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: /Arthur, will you join us\?/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Attendance RSVP" })).not.toBeInTheDocument();
  });
});

describe("RsvpFlow and the optional maybe answer", () => {
  const buttons = () => screen.getAllByRole("button").map((b) => b.textContent ?? "");

  it("offers only yes and no until the couple turns maybe on", async () => {
    open({ allowMaybe: false });
    enter();
    await question("will you join us");

    expect(screen.getByRole("button", { name: /Attending/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Declined/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Not sure yet/ })).not.toBeInTheDocument();
  });

  it("offers a third reply between yes and no, in the couple's own wording", async () => {
    open({ allowMaybe: true, labelMaybe: "Hoping to!" });
    enter();
    await question("will you join us");

    const order = buttons().filter((label) => /Attending|Hoping to!|Declined/.test(label));
    expect(order.map((l) => l.replace(/^[A-Z]\s*/, ""))).toEqual(["Attending", "Hoping to!", "Declined"]);
    expect(screen.queryByRole("button", { name: /Not sure yet/ })).not.toBeInTheDocument();
  });

  it("sends a maybe as a maybe, and still asks about diet and the companions", async () => {
    // Asking again once a guest firms up is what makes people stop replying,
    // so a guest who might come is asked everything one who is coming is.
    const onSaved = vi.fn();
    open({ allowMaybe: true, companions: [guinevere], onSaved });
    enter();
    await question("will you join us");
    fireEvent.click(screen.getByRole("button", { name: /Not sure yet/ }));

    await question("Any dietary restrictions or allergies\\?");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Vegetarian" } });
    enter();
    await question("Anything else");
    enter();

    await question("Will Guinevere join us\\?");
    fireEvent.click(screen.getByRole("button", { name: /Not sure yet/ }));
    await question("Any dietary restrictions");
    expect(screen.getByText(/For Guinevere/)).toBeInTheDocument();
    enter();
    await question("Anything else");
    enter();

    await question("Thank you, Arthur");
    expect(screen.getByText(/Change it here as soon as you know/)).toBeInTheDocument();
    expect(harness.rpc).toHaveBeenCalledTimes(1);
    expect(harness.rpc).toHaveBeenCalledWith("submit_rsvp_response", {
      p_token: "tok",
      p_form_id: "form-1",
      p_status: "maybe",
      p_companions: [{ guest_id: "c-1", status: "maybe" }],
      p_answers: [
        { guest_id: "g-1", answers: { "union-rsvp-dietary": "Vegetarian" } },
        { guest_id: "c-1", answers: {} },
      ],
    });
    expect(onSaved).toHaveBeenCalledWith(
      { status: "maybe", companions: { "c-1": { rsvp_status: "maybe" } } },
      expect.anything(),
    );
  });

  it("asks a guest to pick a firm answer when the couple turned maybe off after they gave one", async () => {
    // Their reply stays on file untouched — converting it would invent a
    // commitment — but the server won't take a maybe again, so the guest is
    // asked for a yes or a no rather than being let through to an error.
    open({ allowMaybe: false, initial: { status: "maybe", companions: {} } });
    enter();
    await question("will you join us");

    expect(screen.getByText(/The couple now need a firm answer/)).toBeInTheDocument();
    // Nothing is shown as picked, and there is no button to move on with.
    expect(screen.queryByRole("button", { name: "OK" })).not.toBeInTheDocument();
    enter();
    expect(screen.getByRole("heading", { name: /will you join us/ })).toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Attending/ }));
    expect(await question("Any dietary restrictions")).toBeInTheDocument();
  });

  it("doesn't say a firm answer is needed to a guest who hasn't replied yet", async () => {
    open({ allowMaybe: false });
    enter();
    await question("will you join us");
    expect(screen.queryByText(/firm answer/)).not.toBeInTheDocument();
  });

  it("still saves a reply when a companion's old maybe is no longer accepted", async () => {
    // The household goes in one transaction, and the server refuses a maybe
    // the wedding no longer accepts. Re-sending Guinevere's old one would have
    // failed the whole reply — Arthur's answer included — so it stays on file
    // and only what the guest actually answered goes out.
    open({
      allowMaybe: false,
      companions: [guinevere],
      initial: { status: "attending", companions: { "c-1": { rsvp_status: "maybe" } } },
    });
    enter();
    await question("will you join us");
    enter(); // keeps the answer already given
    await question("Any dietary restrictions");
    enter();
    await question("Anything else");
    enter();

    await question("Will Guinevere join us\\?"); // she isn't asked again, only offered
    enter();
    await question("Any dietary restrictions"); // she may still come, so she is still asked
    expect(screen.getByText(/For Guinevere/)).toBeInTheDocument();
    enter();
    await question("Anything else");
    enter();

    await question("See you soon, Arthur!");
    expect(harness.rpc).toHaveBeenCalledTimes(1);
    expect(harness.rpc).toHaveBeenCalledWith(
      "submit_rsvp_response",
      expect.objectContaining({ p_status: "attending", p_companions: [] }),
    );
  });
});
