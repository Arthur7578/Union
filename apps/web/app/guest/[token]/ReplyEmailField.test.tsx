// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/client";
import { markGroupLinkArrival } from "@/lib/groupLinkArrival";

/**
 * The email a guest without one gives when they reply (issue #77): they are
 * asked whether it is right before it is saved, since they can't change it
 * afterwards, and the form keeps showing it once it is on file.
 */

const harness = vi.hoisted(() => ({
  rpc: vi.fn(() => Promise.resolve({ data: { status: "ok" }, error: null })),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({ rpc: harness.rpc }),
}));

import { ReplyEmailField, useReplyEmail } from "./ReplyEmailField";

beforeEach(() => {
  window.sessionStorage.clear();
  harness.rpc.mockClear();
});
afterEach(cleanup);

/** The RSVP form around the field, reduced to its submit button. */
function Form({
  emailMissing = true,
  emailHint = null,
}: {
  emailMissing?: boolean;
  emailHint?: string | null;
}) {
  const email = useReplyEmail({ token: "tok", emailMissing, emailHint, isDemo: false });
  const [sent, setSent] = useState(false);
  const submit = async (confirmed?: string) => {
    if (await email.save(confirmed)) setSent(true);
  };
  return (
    <>
      <ReplyEmailField state={email} couple="Maya & Daniel" onConfirmed={(e) => void submit(e)} />
      <button onClick={() => void submit()}>Submit RSVP</button>
      {sent && <p>reply sent</p>}
    </>
  );
}

const renderForm = (props: Parameters<typeof Form>[0] = {}) =>
  render(
    <LocaleProvider initialLocale="en">
      <Form {...props} />
    </LocaleProvider>,
  );

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText(/Your email/), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Submit RSVP" }));

describe("ReplyEmailField", () => {
  it("asks whether the email is right before saving it", async () => {
    renderForm();
    type("julie@example.com");
    submit();

    expect(await screen.findByText("Is this email correct?")).toBeInTheDocument();
    expect(screen.queryByText("reply sent")).not.toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Yes, it's correct" }));
    expect(await screen.findByText("reply sent")).toBeInTheDocument();
    expect(harness.rpc).toHaveBeenCalledWith("set_guest_email", {
      p_token: "tok",
      p_email: "julie@example.com",
    });
  });

  it("lets the guest go back and fix it", async () => {
    renderForm();
    type("julie@example.com");
    submit();
    fireEvent.click(await screen.findByRole("button", { name: "No, let me fix it" }));

    expect(screen.queryByText("Is this email correct?")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Your email/)).toHaveValue("julie@example.com");
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("leads with the fix for a likely typo", async () => {
    renderForm();
    type("julie@gmial.com");
    submit();

    expect(await screen.findByText("Did you mean julie@gmail.com?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use julie@gmail.com" }));

    expect(await screen.findByText("reply sent")).toBeInTheDocument();
    expect(harness.rpc).toHaveBeenCalledWith("set_guest_email", {
      p_token: "tok",
      p_email: "julie@gmail.com",
    });
  });

  it("keeps what the guest typed when they say so", async () => {
    renderForm();
    type("julie@gmial.com");
    submit();
    fireEvent.click(await screen.findByRole("button", { name: "Keep what I typed" }));

    expect(await screen.findByText("reply sent")).toBeInTheDocument();
    expect(harness.rpc).toHaveBeenCalledWith("set_guest_email", {
      p_token: "tok",
      p_email: "julie@gmial.com",
    });
  });

  it("still shows the email once it is saved", async () => {
    renderForm();
    type("Julie@Example.com");
    submit();
    fireEvent.click(await screen.findByRole("button", { name: "Yes, it's correct" }));

    await waitFor(() => expect(screen.getByLabelText(/Your email/)).toHaveValue("julie@example.com"));
    expect(screen.getByLabelText(/Your email/)).toHaveAttribute("readonly");
  });

  it("shows the email on file, masked, to a guest coming back", () => {
    renderForm({ emailMissing: false, emailHint: "j•••@example.com" });

    expect(screen.getByLabelText(/Your email/)).toHaveValue("j•••@example.com");
    expect(screen.getByText(/To change it, ask them/)).toBeInTheDocument();
  });

  it("says an email is on file when there is no hint to show", () => {
    renderForm({ emailMissing: false, emailHint: null });

    expect(screen.getByText("Maya & Daniel already have your email. To change it, ask them.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("requires an email from a guest who came through the group link", async () => {
    markGroupLinkArrival("tok");
    renderForm();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Please enter your email");
    expect(screen.queryByText("Is this email correct?")).not.toBeInTheDocument();
  });

  it("lets a guest on their personal link reply without one", async () => {
    renderForm();
    submit();

    expect(await screen.findByText("reply sent")).toBeInTheDocument();
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});
