import { isValidElement, type ReactNode } from "react";

/**
 * The language a page decided to open in.
 *
 * Server components can't be rendered under vitest, and they don't need to
 * be: a page returns a plain element tree, and the guest-facing pages state
 * their decision on the `initialLocale` prop of the LocaleProvider they wrap
 * their UI in. Reading that prop out of the returned tree keeps the assertion
 * about the decision itself rather than about which component carries it, so
 * adding a wrapper around the provider doesn't break the tests.
 *
 * Test-only helper — nothing in the app imports it.
 */
export function readInitialLocale(node: ReactNode): string {
  const found = findInitialLocale(node, 0);
  if (found === null) {
    throw new Error(
      "No initialLocale in the returned tree. Either the page took a branch " +
        "that renders no LocaleProvider (an unknown token or join code), or " +
        "it stopped deciding a language for the guest.",
    );
  }
  return found;
}

const MAX_DEPTH = 20;

function findInitialLocale(node: ReactNode, depth: number): string | null {
  if (depth > MAX_DEPTH || node === null || typeof node !== "object") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node as ReactNode[]) {
      const found = findInitialLocale(child, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = (node as { props?: unknown }).props as
    | { initialLocale?: unknown; children?: ReactNode }
    | undefined;
  if (typeof props?.initialLocale === "string") return props.initialLocale;
  return findInitialLocale(props?.children ?? null, depth + 1);
}
