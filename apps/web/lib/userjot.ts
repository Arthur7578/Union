/**
 * UserJot SDK helpers.
 *
 * The SDK loader (see `components/UserJot.tsx`) installs a stub `window.uj`
 * Proxy that queues any calls into `window.$ujq` until the real SDK script
 * finishes loading and drains the queue. These helpers push through the same
 * queue so they work regardless of whether the SDK has finished loading yet.
 */

/** UserJot project ID for this app. */
export const USERJOT_PROJECT_ID = "cmrrsmm1d43s40io0ecxhdnv7";

/** Inline loader that installs the queuing `window.uj` stub and injects the SDK. */
export const USERJOT_LOADER_SNIPPET =
  "window.$ujq=window.$ujq||[];" +
  "window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});" +
  "document.head.appendChild(Object.assign(document.createElement('script')," +
  "{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));";

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
