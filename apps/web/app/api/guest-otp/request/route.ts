import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BREVO_API_KEY = process.env.BREVO_TRANSACTIONAL_EMAIL_API_KEY;
const BREVO_SENDER = process.env.BREVO_TRANSACTIONAL_EMAIL_SENDER;

type DirectBody = { mode: "direct"; email?: unknown };
type BootstrapBody = {
  mode: "bootstrap";
  joinCode?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  email?: unknown;
};
type Body = DirectBody | BootstrapBody;

const GENERIC_SENT = { status: "sent" };

/** first char + stars before the @, first char + stars of the domain name,
 *  the TLD kept intact — e.g. "arthur@example.com" -> "a****@e******.com". */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const maskPart = (s: string) =>
    s.length <= 1 ? "*" : `${s[0]}${"*".repeat(s.length - 1)}`;
  const domainParts = domain.split(".");
  const tld = domainParts.pop() ?? "";
  const domainName = domainParts.join(".");
  return `${maskPart(local)}@${maskPart(domainName)}.${tld}`;
}

/** Best-effort send — failures are logged, never surfaced to the guest
 *  (the caller always gets back a generic "sent" status regardless). */
async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!BREVO_API_KEY || !BREVO_SENDER) {
    console.error("Guest OTP email not sent: Brevo is not configured.");
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: BREVO_SENDER, name: "Union" },
        to: [{ email: to }],
        subject: "Your Union sign-in code",
        textContent: `Your one-time code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Brevo rejected the guest OTP email:", res.status, detail);
    }
  } catch (err) {
    console.error("Failed to reach Brevo for the guest OTP email:", err);
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.mode !== "direct" && body.mode !== "bootstrap") {
    return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (body.mode === "direct") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("request_guest_otp", {
      p_email: email,
    });
    if (error) {
      console.error("request_guest_otp failed:", error);
      return NextResponse.json(GENERIC_SENT);
    }

    const result = data as { status: string; code?: string; email?: string };
    if (result.status === "sent" && result.code && result.email) {
      await sendOtpEmail(result.email, result.code);
    }
    if (result.status === "cooldown" || result.status === "too_many_requests") {
      return NextResponse.json({ status: result.status });
    }
    // Every other outcome (matched-and-sent, or no match at all) looks
    // identical to the browser — never reveal whether this email is a guest.
    return NextResponse.json(GENERIC_SENT);
  }

  // mode === "bootstrap"
  const joinCode = typeof body.joinCode === "string" ? body.joinCode.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email =
    typeof body.email === "string" && body.email.trim() ? body.email.trim() : undefined;

  if (!joinCode || !firstName || !phone) {
    return NextResponse.json(
      { error: "joinCode, firstName and phone are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("request_guest_email_otp", {
    p_join_code: joinCode,
    p_first_name: firstName,
    p_last_name: lastName || undefined,
    p_phone: phone,
    p_email: email,
  });
  if (error) {
    console.error("request_guest_email_otp failed:", error);
    return NextResponse.json({ status: "not_found" });
  }

  const result = data as { status: string; code?: string; email?: string };
  if (result.status === "sent" && result.code && result.email) {
    await sendOtpEmail(result.email, result.code);
    return NextResponse.json({
      status: "sent",
      maskedEmail: maskEmail(result.email),
    });
  }
  return NextResponse.json({ status: result.status });
}
