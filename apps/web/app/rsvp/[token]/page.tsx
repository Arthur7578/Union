import { redirect } from "next/navigation";

// Always redirect dynamically to the brand-new guest experience page
export const dynamic = "force-dynamic";

export default async function RsvpRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Cleanly redirect the guest to the premium, immersive Guest Experience
  redirect(`/guest/${token}`);
}
