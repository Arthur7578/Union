import { redirect } from "next/navigation";
import { guestLinkPath } from "@union/shared";

// Legacy spelling of the guest link. Nothing emits /rsvp/<token> any more, but
// links sent before the move are still in guests' inboxes and messages, so it
// keeps redirecting to the guest page.
export const dynamic = "force-dynamic";

export default async function RsvpRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  redirect(guestLinkPath(token));
}
