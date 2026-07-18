import { getSupabase } from "@/lib/supabase";
import { RsvpForm } from "./RsvpForm";

// Always fetch fresh invitation data (no static caching of personal links).
export const dynamic = "force-dynamic";

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_invitation", {
    p_token: token,
  });

  const invitation = !error && data && data.length > 0 ? data[0] : null;

  if (!invitation) {
    return (
      <main className="page">
        <div className="card" style={{ textAlign: "center" }}>
          <div className="brand">Union</div>
          <h1 className="couple">Invitation not found</h1>
          <p className="muted">
            This link doesn&apos;t match an invitation. Please double-check the
            link the couple sent you.
          </p>
        </div>
      </main>
    );
  }

  return <RsvpForm token={token} invitation={invitation} />;
}
