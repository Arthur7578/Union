import { NextResponse } from "next/server";
import { createUnionClient } from "@union/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jriyeblycrzpozjuexvr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_G0fMYmSyYm4hJWterPh3eg_GLdE92V-";
const SUPABASE_ADMIN_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ""
).trim();

/**
 * Inviting a collaborator is two things that have to happen together: a
 * `wedding_collaborators` row (so `accept_pending_invites()` has something
 * to flip when that email signs in) and an actual email telling the person
 * they've been invited. The row alone is what shipped first — an invite
 * nobody ever hears about.
 *
 * The email goes out through Supabase Auth rather than a new provider,
 * because Auth's mailer is already the one delivering this app's sign-in
 * codes. Existing users can receive that ordinary sign-in email with the
 * publishable key. Only creating a brand-new invited Auth user needs the
 * server-only Supabase secret key (or legacy service-role key).
 *
 * The row is written first, with the caller's own JWT so RLS still decides
 * whether they may invite anyone here at all. If the mail then fails we
 * keep the row and say so, rather than rolling back — a pending invite is
 * still honoured the moment that person signs in on their own, so throwing
 * it away would turn a delivery hiccup into lost intent.
 */

const EMAIL_RE = /^\S+@\S+\.\S+$/;

type Body = {
  weddingId?: unknown;
  email?: unknown;
};

/**
 * "This deployment has no secret key" is an unhelpful thing to be told when
 * you're certain you set one — the useful questions are always *which*
 * deployment is saying it, and whether the name is present under a different
 * spelling or scoped to an environment this deployment isn't in.
 *
 * Logged server-side only (names, never values) so the answer is in the
 * Vercel function logs rather than in a response body the inviter can see.
 * The inviter gets the localised "saved, but we couldn't email them" copy;
 * the fix itself is an operator task and lives here.
 */
function logMissingAdminKey(): void {
  const visible = Object.keys(process.env)
    .filter((k) => /SUPABASE/i.test(k))
    .sort();
  console.error(
    "[invite-collaborator] invite saved but not emailed: the recipient has no " +
      "Union account and this deployment has no SUPABASE_SECRET_KEY with which " +
      "to create one. Set SUPABASE_SECRET_KEY for this environment (or connect " +
      "the Supabase integration to it) and redeploy. " +
      [
        `VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}`,
        `VERCEL_TARGET_ENV=${process.env.VERCEL_TARGET_ENV ?? "unset"}`,
        `deployment=${process.env.VERCEL_URL ?? "unset"}`,
        `Supabase vars visible here: ${visible.length ? visible.join(", ") : "none"}`,
      ].join(" · "),
  );
}

/**
 * The invite row is saved but the email didn't go out. The inviter gets the
 * client's localised "saved, but we couldn't email them" copy, so the response
 * carries no `reason`: the upstream error is English, often technical, and not
 * theirs to act on, so it goes to the server log instead.
 */
function notDelivered(
  collaborator: object,
  stage: string,
  err: { message: string; code?: string; status?: number },
) {
  console.error(
    `[invite-collaborator] invite saved but not emailed (${stage}): ${err.message}`,
    { code: err.code, status: err.status },
  );
  return NextResponse.json({ collaborator, delivered: false });
}

/** Prefer the canonical production URL when configured. Supabase only honors
 * redirect targets on its allow list, so using a transient Host header in
 * production can silently fall back to the project's Site URL. */
function appOrigin(request: Request): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_ENV === "production"
      ? "https://union-silk.vercel.app"
      : null,
    request.headers.get("origin"),
    request.url,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // Try the next source.
    }
  }
  return "";
}

/** Supabase surfaces "there's already an account here" through a few
 *  different shapes depending on version; treat any of them as the same
 *  case, since it changes which mail we send rather than being an error. */
function isExistingUser(err: { code?: string; status?: number; message?: string }): boolean {
  const code = (err.code ?? "").toLowerCase();
  const message = (err.message ?? "").toLowerCase();
  return (
    code === "email_exists" ||
    err.status === 422 ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("already exists")
  );
}

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
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!weddingId || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "weddingId and a valid email are required." },
      { status: 400 },
    );
  }

  // Bound to the caller's JWT, so RLS — not this route — is what decides
  // whether they own the wedding they're inviting into.
  const supabase = createUnionClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: wedding, error: wErr } = await supabase
    .from("weddings")
    .select("id, owner_id, partner_one, partner_two")
    .eq("id", weddingId)
    .maybeSingle();
  if (wErr || !wedding) {
    return NextResponse.json({ error: "Wedding not found." }, { status: 404 });
  }
  if (wedding.owner_id !== userData.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Inviting the address you're signed in as would create a collaborator
  // row shadowing the owner, who is never stored as one.
  if ((userData.user.email ?? "").toLowerCase() === email) {
    return NextResponse.json({ error: "self_invite" }, { status: 400 });
  }

  const { data: insertedRow, error: insertErr } = await supabase
    .from("wedding_collaborators")
    .insert({ wedding_id: weddingId, email })
    .select("*")
    .single();
  let row = insertedRow;
  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      // A previous delivery failure leaves a useful pending row behind. Let
      // the owner retry that address without first deleting and recreating it.
      const { data: existing, error: existingErr } = await supabase
        .from("wedding_collaborators")
        .select("*")
        .eq("wedding_id", weddingId)
        .ilike("email", email)
        .maybeSingle();
      if (existingErr || !existing || existing.status !== "pending") {
        return NextResponse.json({ error: "duplicate" }, { status: 409 });
      }
      row = existing;
    } else {
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }
  }

  if (!row) {
    return NextResponse.json({ error: "Couldn't save that invite." }, { status: 500 });
  }

  const collaborator = { ...row, profile_full_name: null };

  const origin = appOrigin(request);

  const invitationUrl = origin
    ? `${origin}/invitation?wedding=${encodeURIComponent(weddingId)}`
    : undefined;

  // A publishable Auth client can email an existing account; no elevated key
  // is needed. Ask the database only about this owner's already-saved pending
  // invite so the route does not become a general account lookup endpoint.
  const { data: recipientExists, error: recipientLookupErr } = await supabase.rpc(
    "invitation_recipient_exists",
    { p_wedding_id: weddingId, p_email: email },
  );
  if (recipientLookupErr) {
    return notDelivered(collaborator, "recipient lookup", recipientLookupErr);
  }

  if (recipientExists) {
    // Deliberately not the `supabase` client above: that one carries the
    // inviter's bearer token on every request, and this call is about a
    // different person's session entirely.
    const anon = createUnionClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: otpErr } = await anon.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: invitationUrl,
      },
    });
    if (!otpErr) {
      return NextResponse.json({
        collaborator,
        delivered: true,
        kind: "existing",
      });
    }
    return notDelivered(collaborator, "sign-in email to existing account", otpErr);
  }

  if (!SUPABASE_ADMIN_KEY) {
    logMissingAdminKey();
    // No `reason`: the client falls back to its localised "saved, but we
    // couldn't email them" copy, which is all the inviter can act on.
    return NextResponse.json({ collaborator, delivered: false });
  }

  const admin = createUnionClient(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const inviterName =
    wedding.partner_one?.trim() ||
    userData.user.email ||
    "Someone";
  const coupleName = [wedding.partner_one, wedding.partner_two]
    .map((n) => n?.trim())
    .filter(Boolean)
    .join(" & ");

  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: invitationUrl,
    // Surfaced to the email template as {{ .Data.* }} so the invite can read
    // as "Arthur invited you" rather than a bare product notification.
    data: {
      invited_by: inviterName,
      wedding_couple: coupleName,
      wedding_id: weddingId,
    },
  });

  if (!inviteErr) {
    return NextResponse.json({ collaborator, delivered: true, kind: "invited" });
  }

  // The account may have been created between our lookup and admin invite.
  // Retry through the existing-user path in that narrow race.
  if (isExistingUser(inviteErr)) {
    const anon = createUnionClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: otpErr } = await anon.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: invitationUrl,
      },
    });
    if (!otpErr) {
      return NextResponse.json({
        collaborator,
        delivered: true,
        kind: "existing",
      });
    }
    return notDelivered(
      collaborator,
      "sign-in email after account appeared mid-invite",
      otpErr,
    );
  }

  return notDelivered(collaborator, "admin invite", inviteErr);
}
