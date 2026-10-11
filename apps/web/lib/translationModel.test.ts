import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_MODEL,
  forgetTranslationModel,
  pickLatestOpus,
  resolveTranslationModel,
  type ModelLister,
} from "./translationModel";

type Listing = Awaited<ReturnType<ModelLister["models"]["list"]>>["data"];

/** A listing entry. `capabilities` is whatever the test needs, cast: the real
 *  type has a dozen fields the code under test never reads. */
function model(
  id: string,
  created_at: string,
  capabilities: { structured?: boolean; effort?: boolean } | null = {},
): Listing[number] {
  return {
    id,
    created_at,
    capabilities:
      capabilities === null
        ? null
        : ({
            structured_outputs: { supported: capabilities.structured ?? true },
            effort: { supported: capabilities.effort ?? true },
          } as unknown as Listing[number]["capabilities"]),
  };
}

const T0 = Date.UTC(2026, 9, 3);
const MINUTE = 60 * 1000;

function lister(impl: () => Promise<{ data: Listing }>) {
  const list = vi.fn(impl);
  return { client: { models: { list } } as ModelLister, list };
}

beforeEach(() => {
  forgetTranslationModel();
  vi.stubEnv("ANTHROPIC_TRANSLATE_MODEL", "");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("pickLatestOpus", () => {
  it("returns the newest Opus and ignores other families", () => {
    expect(
      pickLatestOpus([
        model("claude-sonnet-5-5", "2026-09-20T00:00:00Z"),
        model("claude-opus-5", "2026-05-01T00:00:00Z"),
        model("claude-opus-5-5", "2026-08-01T00:00:00Z"),
        model("claude-opus-4-8", "2026-02-01T00:00:00Z"),
      ]),
    ).toBe("claude-opus-5-5");
  });

  it("returns null when no Opus is listed", () => {
    expect(
      pickLatestOpus([
        model("claude-sonnet-5-5", "2026-09-20T00:00:00Z"),
        model("claude-haiku-4-5", "2025-10-01T00:00:00Z"),
      ]),
    ).toBeNull();
    expect(pickLatestOpus([])).toBeNull();
  });

  it("skips an Opus that can't do structured output or effort", () => {
    expect(
      pickLatestOpus([
        model("claude-opus-9", "2027-01-01T00:00:00Z", { structured: false }),
        model("claude-opus-8", "2026-12-01T00:00:00Z", { effort: false }),
        model("claude-opus-5-5", "2026-08-01T00:00:00Z"),
      ]),
    ).toBe("claude-opus-5-5");
  });

  it("doesn't rule a model out when the API gave no capabilities", () => {
    expect(
      pickLatestOpus([
        model("claude-opus-6", "2027-01-01T00:00:00Z", null),
        model("claude-opus-5-5", "2026-08-01T00:00:00Z"),
      ]),
    ).toBe("claude-opus-6");
  });

  it("doesn't let an epoch placeholder date beat a real one", () => {
    expect(
      pickLatestOpus([
        model("claude-opus-unknown-date", "1970-01-01T00:00:00Z"),
        model("claude-opus-5", "2026-05-01T00:00:00Z"),
      ]),
    ).toBe("claude-opus-5");
    expect(
      pickLatestOpus([
        model("claude-opus-garbled", "not a date"),
        model("claude-opus-5", "2026-05-01T00:00:00Z"),
      ]),
    ).toBe("claude-opus-5");
  });

  it("keeps the API's order when dates tie", () => {
    expect(
      pickLatestOpus([
        model("claude-opus-first", "2026-05-01T00:00:00Z"),
        model("claude-opus-second", "2026-05-01T00:00:00Z"),
      ]),
    ).toBe("claude-opus-first");
  });
});

describe("resolveTranslationModel", () => {
  const listing = () =>
    Promise.resolve({
      data: [
        model("claude-opus-5-5", "2026-08-01T00:00:00Z"),
        model("claude-opus-5", "2026-05-01T00:00:00Z"),
      ],
    });

  it("uses an explicit pin without asking the API", async () => {
    vi.stubEnv("ANTHROPIC_TRANSLATE_MODEL", "  claude-pinned  ");
    const { client, list } = lister(listing);
    expect(await resolveTranslationModel(client, T0)).toBe("claude-pinned");
    expect(list).not.toHaveBeenCalled();
  });

  it("uses the newest Opus, asking with a short timeout and no retries", async () => {
    const { client, list } = lister(listing);
    expect(await resolveTranslationModel(client, T0)).toBe("claude-opus-5-5");
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxRetries: 0, timeout: expect.any(Number) }),
    );
  });

  it("remembers the answer for an hour, then asks again", async () => {
    const { client, list } = lister(listing);
    await resolveTranslationModel(client, T0);
    await resolveTranslationModel(client, T0 + 59 * MINUTE);
    expect(list).toHaveBeenCalledTimes(1);
    await resolveTranslationModel(client, T0 + 61 * MINUTE);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("falls back when the listing fails, without retrying for a minute", async () => {
    const { client, list } = lister(() => Promise.reject(new Error("offline")));
    expect(await resolveTranslationModel(client, T0)).toBe(FALLBACK_MODEL);
    expect(await resolveTranslationModel(client, T0 + 30 * 1000)).toBe(
      FALLBACK_MODEL,
    );
    expect(list).toHaveBeenCalledTimes(1);

    // After the short window it tries again, and recovers.
    list.mockImplementation(listing);
    expect(await resolveTranslationModel(client, T0 + 61 * 1000)).toBe(
      "claude-opus-5-5",
    );
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("falls back when the listing has no usable Opus", async () => {
    const { client } = lister(() =>
      Promise.resolve({ data: [model("claude-haiku-4-5", "2025-10-01T00:00:00Z")] }),
    );
    expect(await resolveTranslationModel(client, T0)).toBe(FALLBACK_MODEL);
  });

  it("asks again straight after the remembered answer is forgotten", async () => {
    const { client, list } = lister(listing);
    await resolveTranslationModel(client, T0);
    forgetTranslationModel();
    await resolveTranslationModel(client, T0 + MINUTE);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("logs a change of model once, not on every call", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { client } = lister(listing);
    await resolveTranslationModel(client, T0);
    await resolveTranslationModel(client, T0 + 61 * MINUTE);
    expect(info).toHaveBeenCalledTimes(1);
  });
});
