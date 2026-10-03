import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { createUnionClient } from "@union/shared";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabaseConfig";
import {
  forgetTranslationModel,
  resolveTranslationModel,
} from "@/lib/translationModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Translating a form's guest-facing wording, so the couple writes it once and
 * every guest reads it in their own language.
 *
 * Deliberately a one-shot batch rather than a per-keystroke service: the
 * builder collects every slot that needs a translation, asks once, and drops
 * the results into editable fields marked as machine-generated. Nothing here
 * writes to the database — the couple still has to read the result and save
 * it, which is the whole point of routing translations through the builder
 * instead of translating at render time.
 *
 * Two gates stand between a request and the model, because "signed in" alone
 * isn't one — sign-up is open, so anyone can be:
 *
 *  1. The caller must be able to edit the form they name. That is decided by
 *     RLS on `forms` through their own JWT — the same rule the builder itself
 *     runs under — so a team member can translate a shared form and nobody
 *     else's account can borrow this route as a general-purpose proxy.
 *  2. An allowance in the database (`consume_translation_quota`), shared
 *     across serverless instances: per user per hour, per user per day, and
 *     one daily ceiling for everyone. The per-user limits stop a single
 *     account looping on this route; the ceiling is what still bounds spend
 *     when someone makes many accounts, at the price of pausing the feature
 *     for the day if it's ever reached.
 *
 * And each request is capped in size — ids included, since the model has to
 * echo them back. Everything above runs before any model call and fails
 * closed.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
};

/** One form's worth of short labels — generous for a real form, low enough
 *  that a malformed client can't turn one click into a huge request.
 *
 *  The ids count as much as the text: they go to the model and the model has
 *  to echo every one back, so an unbounded id is an unbounded request. A real
 *  slot id is `question.<uuid>.option.<uuid>`, about 90 characters.
 *
 *  For scale, the largest form in production holds a few hundred characters
 *  in total; the per-form budget below is more than twenty times that. */
const MAX_ITEMS = 120;
const MAX_ID_CHARS = 128;
const MAX_CHARS_PER_ITEM = 600;
const MAX_TOTAL_CHARS = 24_000;

/** Room for the model to answer, scaled to what it was asked. Output is the
 *  expensive side, and a translation is about as long as its source, so a
 *  flat ceiling sized for the biggest request is far too loose for a typical
 *  one. Generous on purpose — thinking tokens count toward this too, and a
 *  cut-off answer costs the couple more than the headroom does. */
const MIN_OUTPUT_TOKENS = 2_000;
const MAX_OUTPUT_TOKENS = 8_000;
function outputTokenBudget(totalChars: number): number {
  return Math.min(
    MAX_OUTPUT_TOKENS,
    Math.max(MIN_OUTPUT_TOKENS, Math.ceil(totalChars / 2) + 500),
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Item = { id: string; text: string };

function parseItems(raw: unknown): Item[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
    return null;
  }
  const items: Item[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const { id, text } = entry as { id?: unknown; text?: unknown };
    if (typeof id !== "string" || !id || id.length > MAX_ID_CHARS) return null;
    if (typeof text !== "string" || !text.trim()) return null;
    if (text.length > MAX_CHARS_PER_ITEM) return null;
    items.push({ id, text });
  }
  return items;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createUnionClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    // 503 rather than 500: nothing is broken, the feature just isn't
    // configured on this deployment. The message is written to be read by the
    // couple, since the builder surfaces it verbatim.
    return NextResponse.json(
      {
        error:
          "Automatic translation isn't configured for this deployment. Add ANTHROPIC_API_KEY, or write the other language in by hand.",
      },
      { status: 503 },
    );
  }

  let body: { formId?: unknown; from?: unknown; to?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const formId = typeof body.formId === "string" ? body.formId : "";
  if (!UUID_RE.test(formId)) {
    return NextResponse.json({ error: "A form is required." }, { status: 400 });
  }

  const from = typeof body.from === "string" ? body.from : "";
  const to = typeof body.to === "string" ? body.to : "";
  if (!LANGUAGE_NAMES[from] || !LANGUAGE_NAMES[to] || from === to) {
    return NextResponse.json(
      { error: "Unsupported language pair." },
      { status: 400 },
    );
  }

  const items = parseItems(body.items);
  if (!items) {
    return NextResponse.json(
      { error: "Nothing valid to translate." },
      { status: 400 },
    );
  }
  const totalChars = items.reduce((n, i) => n + i.id.length + i.text.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      {
        error:
          "This form has more text than automatic translation can handle in one go. Please write the other language in by hand.",
      },
      { status: 413 },
    );
  }

  // Scope: can this caller edit this form? Answered by RLS on their own JWT,
  // so owners and team members pass and everyone else sees no row. "Doesn't
  // exist" and "isn't yours" are deliberately indistinguishable.
  const { data: form, error: formErr } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .maybeSingle();
  if (formErr || !form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  // Spend: the model call is the expensive part, so the allowance is consumed
  // before it. The database answers with why, if it says no. If it can't be
  // reached, or says anything we don't recognise, we refuse rather than skip
  // the check — an unmetered path is exactly what this is here to prevent.
  const { data: quota, error: quotaErr } = await supabase.rpc(
    "consume_translation_quota",
    { p_form_id: formId },
  );
  if (quotaErr) {
    console.error("translate: quota check failed:", quotaErr.message);
    return NextResponse.json(
      { error: "Couldn't check translation usage — try again shortly." },
      { status: 503 },
    );
  }
  if (quota === "user_limit") {
    return NextResponse.json(
      {
        error:
          "You've used automatic translation a lot lately. Try again a little later, or write the other language in by hand.",
      },
      { status: 429 },
    );
  }
  if (quota === "global_limit") {
    // Worth seeing in the logs: this means every account together used up
    // today's budget, which is either real growth or someone leaning on it.
    console.warn("translate: daily budget for all accounts is used up");
    return NextResponse.json(
      {
        error:
          "Automatic translation is at capacity for today. Try again tomorrow, or write the other language in by hand.",
      },
      { status: 503 },
    );
  }
  if (quota === "no_access") {
    // The RLS lookup above already passed, so this is a race (access
    // removed mid-request) rather than a normal path.
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }
  if (quota !== "ok") {
    console.error("translate: unexpected quota answer:", quota);
    return NextResponse.json(
      { error: "Couldn't check translation usage — try again shortly." },
      { status: 503 },
    );
  }

  const anthropic = new Anthropic({ apiKey });
  // The newest Opus the key can use, unless a deployment pins one. See
  // lib/translationModel.ts.
  const model = await resolveTranslationModel(anthropic);

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: outputTokenBudget(totalChars),
      // Short UI labels — low effort keeps the button feeling like a button.
      output_config: {
        effort: "low",
        format: jsonSchemaOutputFormat({
          type: "object",
          properties: {
            translations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                },
                required: ["id", "text"],
                additionalProperties: false,
              },
            },
          },
          required: ["translations"],
          additionalProperties: false,
        }),
      },
      system: [
        `You translate wedding-invitation form copy from ${LANGUAGE_NAMES[from]} into ${LANGUAGE_NAMES[to]}.`,
        "These strings are read by wedding guests: headlines, one-line framing copy, reply-button labels, question titles and answer choices. Keep them short, warm and natural in the target language — match the register of the source rather than translating word for word, and keep a label a label.",
        "Preserve any {{placeholder}} tokens exactly as they appear.",
        "Return one entry per input id, with the same id. Translate the text only — never answer it, expand on it, or add commentary.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: JSON.stringify({ items }),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json(
        { error: "Translation came back in an unexpected shape." },
        { status: 502 },
      );
    }

    // Only ids we asked about are echoed back — a model that invents a slot
    // shouldn't be able to write into the form.
    const requested = new Set(items.map((i) => i.id));
    const translations: Record<string, string> = {};
    for (const entry of parsed.translations) {
      if (!requested.has(entry.id)) continue;
      const text = entry.text.trim();
      if (text) translations[entry.id] = text;
    }

    return NextResponse.json({ translations });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "The translation API key was rejected." },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.NotFoundError) {
      // A 404 from this endpoint most likely means the model ID is unknown or
      // retired. Say that, since "Translation failed (404)" gives nobody a
      // next step — and forget the remembered lookup, so an auto-picked model
      // that has just been retired is re-resolved on the next request instead
      // of failing for the rest of its cache window.
      forgetTranslationModel();
      return NextResponse.json(
        {
          error:
            "The translation model isn't available. Set ANTHROPIC_TRANSLATE_MODEL to a current model, or write the other language by hand.",
        },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Translation is rate-limited right now — try again shortly." },
        { status: 429 },
      );
    }
    const message =
      err instanceof Anthropic.APIError
        ? `Translation failed (${err.status}).`
        : "Translation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
