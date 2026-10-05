"use client";

import { WelcomeGate } from "@/components/guest/WelcomeGate";
import { formatGuestAddress } from "@/lib/guestAddress";
import { GuestIdentityGate } from "./GuestIdentityGate";
import { GuestPortal } from "./GuestPortal";
import type { DBInvitation } from "./page";

/**
 * What a guest passes through, in order, on their personal link: the
 * invitation first, then the identity check if another guest is active on
 * this device, then the hub.
 *
 * The order is the point. Identification is a step on the way to the hub, not
 * the first thing a guest meets, so the welcome sits in front of it. Nothing
 * here asks for an email: a guest without one is asked when they reply (see
 * ReplyEmailField), and a personal link never requires it.
 */
export function GuestEntry({
  token,
  invitation,
  isDemo,
  emailMissing,
}: {
  token: string;
  invitation: DBInvitation;
  isDemo: boolean;
  emailMissing: boolean;
}) {
  const guestName = [invitation.guest.first_name, invitation.guest.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <WelcomeGate
      token={token}
      isDemo={isDemo}
      seen={Boolean(invitation.guest.welcome_seen_at)}
      guestName={invitation.guest.first_name}
      partnerOne={invitation.wedding.partner_one}
      partnerTwo={invitation.wedding.partner_two}
      eventDate={invitation.wedding.event_date}
      venueName={invitation.wedding.venue_name}
      address={formatGuestAddress(invitation.wedding)}
    >
      <GuestIdentityGate guestId={invitation.guest.id} guestName={guestName}>
        <GuestPortal
          token={token}
          invitation={invitation}
          isDemo={isDemo}
          emailMissing={emailMissing}
        />
      </GuestIdentityGate>
    </WelcomeGate>
  );
}
