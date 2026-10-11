// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Options = {
  sitekey: string;
  appearance?: string;
  retry?: string;
  "refresh-expired"?: string;
  "refresh-timeout"?: string;
  callback?: (token: string) => void;
  "error-callback"?: (errorCode: string) => boolean | void;
};

const fakeTurnstile = {
  render: vi.fn<(container: HTMLElement, options: Options) => string>(),
  remove: vi.fn<(widgetId: string) => void>(),
};

/** The site key is read once at import, so each case loads a fresh module. */
async function loadHook(siteKey: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", siteKey);
  return import("./turnstile");
}

/** Mounts the hook the way a form does: container rendered, token on demand. */
async function mount(siteKey: string) {
  const mod = await loadHook(siteKey);
  let getToken!: () => Promise<string | undefined>;
  function Harness() {
    const { captcha, getCaptchaToken } = mod.useTurnstile();
    getToken = getCaptchaToken;
    return <form>{captcha}</form>;
  }
  const view = render(<Harness />);
  return { ...mod, getToken: () => getToken(), view };
}

beforeEach(() => {
  fakeTurnstile.render.mockReset().mockReturnValue("widget-1");
  fakeTurnstile.remove.mockReset();
  (window as unknown as { turnstile: unknown }).turnstile = fakeTurnstile;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

describe("useTurnstile", () => {
  it("does nothing when no site key is configured", async () => {
    const { getToken, view } = await mount("");

    expect(await getToken()).toBeUndefined();
    expect(fakeTurnstile.render).not.toHaveBeenCalled();
    expect(view.container.querySelector("form")?.children).toHaveLength(0);
  });

  it("renders an interaction-only widget and resolves its token", async () => {
    fakeTurnstile.render.mockImplementation((_container, options) => {
      options.callback?.("token-abc");
      return "widget-1";
    });
    const { getToken, view } = await mount("site-key");

    expect(await getToken()).toBe("token-abc");

    const [container, options] = fakeTurnstile.render.mock.calls[0];
    expect(container).toBe(view.container.querySelector("form > div"));
    expect(options.sitekey).toBe("site-key");
    expect(options.appearance).toBe("interaction-only");
    // The widget is removed as soon as it settles, so Turnstile must not
    // schedule its own retry/refresh against it (that throws "Nothing to reset
    // found for provided container" a moment later).
    expect(options.retry).toBe("never");
    expect(options["refresh-expired"]).toBe("never");
    expect(options["refresh-timeout"]).toBe("never");
    // Tokens are single-use, so the widget is discarded once it has delivered.
    expect(fakeTurnstile.remove).toHaveBeenCalledWith("widget-1");
  });

  it("runs a fresh challenge for every call", async () => {
    let n = 0;
    fakeTurnstile.render.mockImplementation((_container, options) => {
      options.callback?.(`token-${++n}`);
      return `widget-${n}`;
    });
    const { getToken } = await mount("site-key");

    expect(await getToken()).toBe("token-1");
    expect(await getToken()).toBe("token-2");
  });

  it("rejects with a CaptchaError carrying Turnstile's error code", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let handled: boolean | void = undefined;
    fakeTurnstile.render.mockImplementation((_container, options) => {
      handled = options["error-callback"]?.("110200");
      return "widget-1";
    });
    const { getToken, CaptchaError } = await mount("site-key");

    const failure = await getToken().then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(CaptchaError);
    expect((failure as InstanceType<typeof CaptchaError>).code).toBe("110200");
    expect((failure as Error).message).toContain("110200");
    expect(fakeTurnstile.remove).toHaveBeenCalledWith("widget-1");
    // Returning true marks the error as handled so Turnstile doesn't also log
    // its own warning; ours already names the code.
    expect(handled).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("110200"));
    warn.mockRestore();
  });

  it("abandons an in-flight challenge when the form unmounts", async () => {
    const { getToken, view, CaptchaError } = await mount("site-key");

    const pending = getToken();
    // Let the (mocked, never-calling-back) render start before unmounting.
    await vi.waitFor(() => expect(fakeTurnstile.render).toHaveBeenCalled());
    view.unmount();

    await expect(pending).rejects.toBeInstanceOf(CaptchaError);
    expect(fakeTurnstile.remove).toHaveBeenCalledWith("widget-1");
  });
});
