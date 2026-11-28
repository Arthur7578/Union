import { EMPTY_GUEST_PAGE, enabledGuestModules, partHasContent, type GuestModuleKey } from "@union/shared";
import { formatGuestAddress } from "@/lib/guestAddress";
import type { DBInvitation } from "./page";

/**
 * The parts of the wedding page a guest sees, in order: the ones the couple
 * left on in Guests › Guest experience, and only those with something in
 * them, so a guest never meets an empty title. The reply is not one of them:
 * it always closes the page.
 */
export function shownParts(invitation: DBInvitation): GuestModuleKey[] {
  const guestPage = invitation.guest_page ?? EMPTY_GUEST_PAGE;
  const address = formatGuestAddress(invitation.wedding);
  return enabledGuestModules(invitation.wedding.guest_modules).filter((key) =>
    partHasContent(key, { ...guestPage, venueName: invitation.wedding.venue_name, address }),
  );
}
