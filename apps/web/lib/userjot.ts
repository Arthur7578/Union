/**
 * UserJot SDK helpers.
 *
 * The SDK loader (see `components/UserJot.tsx`) installs a stub `window.uj`
 * Proxy that queues any calls into `window.$ujq` until the real SDK script
 * finishes loading and drains the queue. These helpers push through the same
 * queue so they work regardless of whether the SDK has finished loading yet.
 *
 * We deliberately run the SDK *without* its floating launcher (see
 * `SHOW_FLOATING_LAUNCHER`): the bubble sat on top of the tab bar, the vendor
 * search composer and every bottom-anchored action in the app. Feedback lives
 * in the account area instead — see `app/(app)/account/feedback/page.tsx` —
 * and the panel is opened from there with `ujShowWidget()`.
 */

/** UserJot project ID for this app. */
export const USERJOT_PROJECT_ID = "cmrrsmm1d43s40io0ecxhdnv7";

/**
 * Whether the SDK mounts its own floating launcher bubble.
 *
 * Off: it overlapped the mobile tab bar and bottom-anchored controls, which is
 * what pushed feedback into the account area in the first place. Flip this to
 * `true` to get the bubble back (the tab-bar lift in `components/UserJot.tsx`
 * is still wired up for that case).
 */
export const SHOW_FLOATING_LAUNCHER = false;

/** Inline loader that installs the queuing `window.uj` stub and injects the SDK. */
export const USERJOT_LOADER_SNIPPET =
  "window.$ujq=window.$ujq||[];" +
  "window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});" +
  "document.head.appendChild(Object.assign(document.createElement('script')," +
  "{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));";

/** The panel views the widget can open onto. */
export type UserJotSection = "feedback" | "roadmap" | "updates";

export type UserJotUser = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
};

declare global {
  interface Window {
    $ujq?: unknown[];
    uj?: Record<string, (...args: unknown[]) => void>;
  }
}

/** Call a UserJot method, falling back to the queue if the SDK isn't ready. */
function ujCall(method: string, ...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const uj = window.uj;
  if (uj && typeof uj[method] === "function") {
    uj[method](...args);
  } else {
    (window.$ujq = window.$ujq || []).push([method, ...args]);
  }
}

/** Link subsequent feedback to a signed-in user. */
export function ujIdentify(user: UserJotUser): void {
  // Drop undefined fields so we never send empty attributes.
  const payload = Object.fromEntries(
    Object.entries(user).filter(([, v]) => v != null && v !== ""),
  );
  ujCall("identify", payload);
}

/** The element the SDK mounts its widget into, once it has booted. */
const WIDGET_HOST_ID = "userjot-widget-container";

/**
 * Open the feedback panel on a given section.
 *
 * Every entry point in the app goes through here, because with the launcher
 * off this is the only way in. If the SDK hasn't mounted its host element a
 * moment after we ask — the one way running launcher-less could leave a user
 * with a dead button — we re-enable the widget and ask again, so feedback
 * still opens rather than silently doing nothing.
 */
export function ujShowWidget(section: UserJotSection = "feedback"): void {
  // `showWidget()` with no argument lands on feedback, which is the section we
  // want most of the time — only name one when it's somewhere else.
  const args = section === "feedback" ? [] : [{ section }];

  ujCall("showWidget", ...args);
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    if (document.getElementById(WIDGET_HOST_ID)) return;
    ujCall("setWidgetEnabled", true);
    ujCall("showWidget", ...args);
  }, 1200);
}
