import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { createUnionClient } from "@union/shared";

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
 * Requires a signed-in caller. The strings are the couple's own copy, but an
 * unauthenticated endpoint that forwards arbitrary text to a model is an open
 * proxy, and this one is reachable from the public internet.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jriyeblycrzpozjuexvr.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_G0fMYmSyYm4hJWterPh3eg_GLdE92V-";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
};

/** One form's worth of short labels — generous for a real form, low enough
 *  that a malformed client can't turn one click into a huge request. */
const MAX_ITEMS = 120;
const MAX_CHARS_PER_ITEM = 600;

type Item = { id: string; text: string };

function parseItems(raw: unknown): Item[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
    return null;
  }
  const items: Item[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const { id, text } = entry as { id?: unknown; text?: unknown };
    if (typeof id !== "string" || !id) return null;
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

  const supabase = createUnionClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  let body: { from?: unknown; to?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
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

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
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
