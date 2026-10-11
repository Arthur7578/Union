/**
 * Where a guest's personal page lives. Every surface that hands a guest a link
 * (copy-link, email, SMS, the mobile share sheet) builds it here, so the path
 * can't drift between them.
 *
 * `/rsvp/<token>` is the legacy spelling: it still resolves, by redirecting to
 * this path, so links sent before the move keep working — but nothing should
 * emit it any more.
 *
 * The token is a uuid (`guests.invite_token`), already URL-safe, so it is
 * used as-is.
 */
export function guestLinkPath(token: string): string {
  return `/guest/${token}`;
}

/** Absolute link for sharing: the app's origin plus {@link guestLinkPath}. */
export function guestLinkUrl(origin: string, token: string): string {
  return `${origin}${guestLinkPath(token)}`;
}
