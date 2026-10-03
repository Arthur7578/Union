import type Anthropic from "@anthropic-ai/sdk";

/**
 * Which model `/api/translate` runs on.
 *
 * Hardcoding an ID means a retired or superseded model is a code change and a
 * deploy. Instead, in order:
 *
 *   1. `ANTHROPIC_TRANSLATE_MODEL`, when set — an explicit pin always wins, and
 *      is how a deployment opts out of everything below.
 *   2. The newest Opus the API key can list, from the Models API.
 *   3. `FALLBACK_MODEL`, when listing fails or turns up no usable Opus.
 *
 * Step 2 means a new Opus release is picked up without anyone touching this
 * app. The cost of that convenience is that the model — and with it price and
 * behaviour — can change underneath a running deployment; pin it (step 1) when
 * that matters. Each change of model is logged once so it isn't silent.
 */

/**
 * Only used when the Models API can't say what's newest. Keep it a model that
 * exists — it is the last resort, not the preferred choice, so it doesn't need
 * to track every release.
 */
export const FALLBACK_MODEL = "claude-opus-5-5";

/** How long a successful lookup is trusted before asking the API again. */
const FOUND_TTL_MS = 60 * 60 * 1000;

/** After a failed lookup, how long to leave the API alone before retrying, so
 *  an outage doesn't add a failing call to every translation. */
const FAILED_TTL_MS = 60 * 1000;

/** The listing is a courtesy, not the point of the request: give up quickly
 *  rather than hold a couple's translate button for the SDK's default
 *  ten-minute timeout and two retries. */
const LIST_TIMEOUT_MS = 5_000;

const OPUS_ID = /^claude-opus-/;

type ModelLike = Pick<Anthropic.ModelInfo, "id" | "created_at" | "capabilities">;

/** The slice of the SDK client this module needs, so tests can fake it. */
export interface ModelLister {
  models: {
    list(
      params?: { limit?: number },
      options?: { timeout?: number; maxRetries?: number },
    ): PromiseLike<{ data: ModelLike[] }>;
  };
}

/**
 * Whether a model can run the translate request, which uses structured output
 * and an effort level. `capabilities` can be null, meaning the API didn't say —
 * that isn't a reason to rule a model out, only an explicit "unsupported" is.
 */
function canTranslate(model: ModelLike): boolean {
  const caps = model.capabilities;
  if (!caps) return true;
  return caps.structured_outputs.supported && caps.effort.supported;
}

/**
 * The newest Opus in a model listing, or null when there isn't one.
 *
 * Newest means latest `created_at`. The API lists newest first, but says
 * `created_at` may be an epoch placeholder when a release date is unknown, so
 * a model with no real date sorts last rather than winning — and ties keep the
 * API's own order.
 */
export function pickLatestOpus(models: readonly ModelLike[]): string | null {
  const candidates = models
    .filter((m) => OPUS_ID.test(m.id) && canTranslate(m))
    .map((m, index) => ({ id: m.id, index, at: Date.parse(m.created_at) }));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const byDate = (Number.isNaN(b.at) ? 0 : b.at) - (Number.isNaN(a.at) ? 0 : a.at);
    return byDate || a.index - b.index;
  });
  return candidates[0].id;
}

let cached: { model: string; expiresAt: number } | null = null;

/** Drop the remembered lookup so the next call asks the API again. */
export function forgetTranslationModel(): void {
  cached = null;
}

/**
 * The model to translate with. Never throws: any trouble listing models
 * resolves to `FALLBACK_MODEL`.
 */
export async function resolveTranslationModel(
  client: ModelLister,
  now: number = Date.now(),
): Promise<string> {
  const pinned = (process.env.ANTHROPIC_TRANSLATE_MODEL ?? "").trim();
  if (pinned) return pinned;

  if (cached && now < cached.expiresAt) return cached.model;

  let found: string | null = null;
  try {
    const page = await client.models.list(
      { limit: 100 },
      { timeout: LIST_TIMEOUT_MS, maxRetries: 0 },
    );
    found = pickLatestOpus(page.data);
  } catch (err) {
    console.warn(
      "[translate] couldn't list models; using the fallback:",
      err instanceof Error ? err.message : err,
    );
  }

  const model = found ?? FALLBACK_MODEL;
  if (model !== cached?.model) {
    console.info(
      `[translate] using ${model}${found ? " (newest Opus available)" : " (fallback)"}`,
    );
  }
  cached = { model, expiresAt: now + (found ? FOUND_TTL_MS : FAILED_TTL_MS) };
  return model;
}
