import { NextResponse } from "next/server";
import { createUnionClient } from "@union/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jriyeblycrzpozjuexvr.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_G0fMYmSyYm4hJWterPh3eg_GLdE92V-";

// Trim the sender for Brevo. Rules:
//   * numeric → strip everything but leading '+' and digits, keep as-is
//     (Brevo accepts E.164-style numbers).
//   * alphanumeric → keep [A-Za-z0-9 ], truncate to 11 chars (Brevo cap).
function sanitizeSender(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const digitsOnly = raw.replace(/[^\d+]/g, "");
  if (/^\+?\d{6,15}$/.test(digitsOnly)) return digitsOnly;
  const alnum = raw.replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 11);
  return alnum || null;
}

function sanitizeRecipient(input: string): string | null {
  const trimmed = input.replace(/[\s()\-.]/g, "");
  if (!/^\+?\d{6,15}$/.test(trimmed)) return null;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

function resolveTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
    key in vars ? vars[key as keyof typeof vars] : "",
  );
}

/**
 * Brevo's error payloads are a terse `{ code, message }` pair that
 * doesn't tell a non-technical organiser what to actually do. Map the
 * common cases (bad key, no SMS add-on, no credits, IP allow-list,
 * rejected sender/recipient) to plain-language, actionable copy —
 * fall back to Brevo's own message for anything we don't recognise so
 * nothing is ever silently swallowed.
 */
function describeBrevoFailure(
  status: number,
  bodyText: string,
): { message: string; code?: string } {
  let code: string | undefined;
  let brevoMessage = "";
  try {
    const parsed = JSON.parse(bodyText) as { code?: string; message?: string };
    if (typeof parsed.code === "string") code = parsed.code;
    if (typeof parsed.message === "string") brevoMessage = parsed.message;
  } catch {
    brevoMessage = bodyText.trim();
  }
  const haystack = `${code ?? ""} ${brevoMessage}`.toLowerCase();

  if (haystack.includes("unrecognised ip") || haystack.includes("unrecognized ip") || haystack.includes("authorised_ips")) {
    return {
      code,
      message:
        "Brevo blocked this send because of an IP allow-list restriction on your API key. Remove the restriction (or add this app's IP) at Brevo → Security → Authorised IPs, then try again.",
    };
  }
  if (haystack.includes("sms related addon") || haystack.includes("addon")) {
    return {
      code,
      message:
        "Your Brevo account doesn't have SMS enabled yet — SMS credits are a separate purchase from email. Buy the SMS add-on at Brevo → Campaigns → SMS, then try again.",
    };
  }
  if (haystack.includes("credit")) {
    return {
      code,
      message:
        "You're out of Brevo SMS credits. Top up your balance at Brevo → Campaigns → SMS, then try again.",
    };
  }
  if (code === "unauthorized" || status === 401) {
    return {
      code,
      message:
        "Brevo rejected your API key. Open SMS Template settings and check you pasted the correct transactional SMS key from Brevo → Settings → API Keys.",
    };
  }
  if (haystack.includes("sender")) {
    return {
      code,
      message:
        "Brevo rejected your sender ID. It must be a plain name (max 11 letters/digits, no accents) or a phone number in international format — fix it in SMS Template settings.",
    };
  }
  if (haystack.includes("recipient") || haystack.includes("phone") || haystack.includes("mobile number")) {
    return {
      code,
      message:
        "Brevo rejected the guest's phone number. Check it's a valid, reachable number in international format on the guest's detail page.",
    };
  }
  return {
    code,
    message: brevoMessage
      ? `Brevo rejected the message: ${brevoMessage}`
      : "Brevo rejected the request for an unspecified reason.",
  };
}

type Body = {
  weddingId?: unknown;
  guestId?: unknown;
  message?: unknown;
};

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "Missing authorization." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const weddingId = typeof body.weddingId === "string" ? body.weddingId : "";
  const guestId = typeof body.guestId === "string" ? body.guestId : "";
  const clientMessage = typeof body.message === "string" ? body.message : null;
  if (!weddingId || !guestId) {
    return NextResponse.json(
      { error: "weddingId and guestId are required." },
      { status: 400 },
    );
  }

  // Client bound to the caller's JWT. Wedding/guest RLS authorizes either
  // the owner or an accepted collaborator; the anon key remains public.
  const supabase = createUnionClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: wedding, error: wErr } = await supabase
    .from("weddings")
    .select(
      "id, owner_id, partner_one, partner_two, sms_sender, sms_template, sms_brevo_api_key",
    )
    .eq("id", weddingId)
    .maybeSingle();
  if (wErr || !wedding) {
    return NextResponse.json({ error: "Wedding not found." }, { status: 404 });
  }
  // Each wedding brings its own Brevo account — SMS credits are a
  // per-organiser expense, not something the platform key should
  // cover. No platform-wide fallback on purpose.
  const apiKey = (wedding.sms_brevo_api_key ?? "").trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add your Brevo API key in SMS Template settings first." },
      { status: 400 },
    );
  }

  const sender = sanitizeSender(wedding.sms_sender ?? "");
  if (!sender) {
    return NextResponse.json(
      { error: "Configure an SMS sender in your SMS Template settings first." },
      { status: 400 },
    );
  }

  const { data: guest, error: gErr } = await supabase
    .from("guests")
    .select("id, wedding_id, first_name, phone, invite_token")
    .eq("id", guestId)
    .maybeSingle();
  if (gErr || !guest || guest.wedding_id !== weddingId) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }

  const recipient = sanitizeRecipient(guest.phone ?? "");
  if (!recipient) {
    return NextResponse.json(
      { error: "This guest doesn't have a valid phone number." },
      { status: 400 },
    );
  }

  const origin =
    request.headers.get("origin") ||
    (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return "";
      }
    })();
  const guestAccessLink = `${origin}/guest/${guest.invite_token}`;

  const templateVars = {
    guest_first_name: guest.first_name ?? "",
    guest_access_link: guestAccessLink,
    partner_1_first_name: wedding.partner_one ?? "",
    partner_2_first_name: wedding.partner_two ?? "",
  };

  // The organiser may have edited the message in the preview modal —
  // trust the client copy but still resolve any placeholders they left
  // in it so it can't leak {{…}} tokens to the recipient.
  const baseTemplate =
    clientMessage && clientMessage.trim().length > 0
      ? clientMessage
      : wedding.sms_template ?? "";
  const content = resolveTemplate(baseTemplate, templateVars).trim();
  if (!content) {
    return NextResponse.json(
      { error: "Message is empty." },
      { status: 400 },
    );
  }

  const brevoRes = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      recipient,
      content,
      type: "transactional",
    }),
  });

  if (!brevoRes.ok) {
    const bodyText = await brevoRes.text().catch(() => "");
    const { message, code } = describeBrevoFailure(brevoRes.status, bodyText);
    return NextResponse.json(
      { error: message, code, detail: bodyText.slice(0, 500) },
      { status: 502 },
    );
  }

  // Best-effort activity tracking — don't fail the send if this bumps.
  await supabase
    .from("guests")
    .update({ rsvp_reminder_sent_at: new Date().toISOString() })
    .eq("id", guest.id);

  return NextResponse.json({ ok: true, recipient, sender });
}
