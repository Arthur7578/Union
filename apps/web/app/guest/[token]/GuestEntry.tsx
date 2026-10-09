"use client";

import { WelcomeGate } from "@/components/guest/WelcomeGate";
import { formatGuestAddress } from "@/lib/guestAddress";
import { GuestPortal } from "./GuestPortal";
import type { DBInvitation } from "./page";

/**
 * What a guest passes through on their personal link: the invitation first,
 * then the hub. The link itself says who the guest is (the couple sent it to
 * them), so there is no identity step, and nothing here asks for an email: a
 * guest without one is asked when they reply (see ReplyEmailField), and a
 * personal link never requires it.
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
      <GuestPortal
        token={token}
        invitation={invitation}
        isDemo={isDemo}
        emailMissing={emailMissing}
      />
    </WelcomeGate>
  );
}
