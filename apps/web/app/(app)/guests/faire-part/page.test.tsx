// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Wedding } from "@union/shared";
import { LocaleProvider } from "@/lib/i18n/client";

const harness = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateWedding: vi.fn(),
  getSession: vi.fn(),
  wedding: null as Wedding | null,
}));

vi.mock("@/lib/wedding", () => ({
  useWedding: () => ({ wedding: harness.wedding, refresh: harness.refresh }),
}));
vi.mock("@/lib/data", () => ({ updateWedding: harness.updateWedding }));
vi.mock("@/lib/supabaseClient", () => ({
  getBrowserSupabase: () => ({ auth: { getSession: harness.getSession } }),
}));
vi.mock("@/components/BackHeader", () => ({
  BackHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import FairePartPage from "./page";

const wedding = (patch: Partial<Wedding> = {}) =>
  ({
    id: "11111111-1111-4111-8111-111111111111",
    partner_one: "Maya",
    partner_two: "Daniel",
    event_date: "2027-06-12",
    default_locale: "fr",
    address_visibility: "area",
    address_area: "Provence",
    address_country: "France",
    address_city: null,
    address_line: null,
    address_postal_code: null,
    venue_name: null,
    faire_part_copy: {},
    ...patch,
  }) as unknown as Wedding;

const page = () =>
  render(
    <LocaleProvider initialLocale="fr">
      <FairePartPage />
    </LocaleProvider>,
  );

const preview = () => document.querySelector(".fp-preview .verso")!;

beforeEach(() => {
  harness.wedding = wedding();
  harness.refresh.mockResolvedValue(undefined);
  harness.updateWedding.mockResolvedValue({});
  harness.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("the faire-part editor", () => {
  it("starts on the default wording, with a preview for a named guest", () => {
    page();
    expect(screen.getByLabelText("Salutation")).toHaveValue("");
    expect(screen.getByLabelText("Salutation")).toHaveAttribute("placeholder", "{{guest_first_name}},");
    expect(preview()).toHaveTextContent("Léa,");
    expect(preview()).toHaveTextContent("te retrouver en Provence, le 12 juin 2027, pour célébrer");
  });

  it("shows the change in the preview as it is typed, and keeps Save off until then", () => {
    page();
    const save = screen.getByRole("button", { name: "Enregistrer" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Salutation"), { target: { value: "Chère {{guest_first_name}}," } });
    expect(preview()).toHaveTextContent("Chère Léa,");
    expect(save).toBeEnabled();
  });

  it("previews the group link, where no guest is named", () => {
    page();
    fireEvent.change(screen.getByLabelText("Aperçu pour"), { target: { value: "group" } });
    expect(document.querySelector(".fp-preview .greet")).toBeNull();
  });

  it("inserts a field into the line being written", () => {
    page();
    const closing = screen.getByLabelText("Formule de fin");
    fireEvent.focus(closing);
    fireEvent.click(screen.getByRole("button", { name: "{{couple}}" }));
    expect(closing).toHaveValue("{{couple}}");
  });

  it("flags a field that does not exist", () => {
    page();
    fireEvent.change(screen.getByLabelText("Signature"), { target: { value: "{{nope}}" } });
    expect(screen.getByText("Pas un champ : nope")).toBeInTheDocument();
  });

  it("saves only the lines the couple wrote", async () => {
    page();
    fireEvent.change(screen.getByLabelText("Salutation"), { target: { value: "Chère {{guest_first_name}}," } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(harness.updateWedding).toHaveBeenCalled());
    expect(harness.updateWedding).toHaveBeenCalledWith(harness.wedding!.id, {
      faire_part_copy: { greeting: { fr: "Chère {{guest_first_name}}," } },
    });
    expect(await screen.findByText("Enregistré")).toBeInTheDocument();
  });

  it("still says Saved when the app reloads the wedding and remounts the editor", async () => {
    page();
    fireEvent.change(screen.getByLabelText("Salutation"), { target: { value: "Chère {{guest_first_name}}," } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(harness.updateWedding).toHaveBeenCalled());
    cleanup();
    harness.wedding = wedding({ faire_part_copy: { greeting: { fr: "Chère {{guest_first_name}}," } } as never });
    page();
    expect(screen.getByRole("status")).toHaveTextContent("Enregistré");
  });

  it("goes back to the default when a line is cleared", () => {
    harness.wedding = wedding({ faire_part_copy: { closing: { fr: "Bises," } } as never });
    page();
    expect(screen.getByLabelText("Formule de fin")).toHaveValue("Bises,");
    fireEvent.click(screen.getByRole("button", { name: "Revenir au texte par défaut" }));
    expect(screen.getByLabelText("Formule de fin")).toHaveValue("");
    expect(preview()).toHaveTextContent("Avec toute notre affection,");
  });

  it("translates the lines written in this language, and marks them for review", async () => {
    harness.wedding = wedding({ faire_part_copy: { closing: { fr: "Bises," } } as never });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: { closing: "Kisses," } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    page();
    fireEvent.click(screen.getByRole("button", { name: "Traduire en Anglais" }));
    await waitFor(() => expect(screen.getByLabelText("Formule de fin")).toHaveValue("Kisses,"));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      weddingId: harness.wedding!.id,
      from: "fr",
      to: "en",
      items: [{ id: "closing", text: "Bises," }],
    });
    expect(screen.getByText("Auto")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("says so when there is nothing of the couple's own to translate", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    page();
    fireEvent.click(screen.getByRole("button", { name: "Traduire en Anglais" }));
    expect(await screen.findByText(/Modifie d'abord une ligne en Français/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
