#!/usr/bin/env node
/**
 * Senior reviewer from another model provider, through OpenRouter.
 *
 * Why another provider: a model reviewing code written by the same model tends
 * to share its blind spots. This reviewer only reads (plan, criteria, design,
 * diff) and answers with JSON; it never touches the repo.
 *
 * Usage: node review-external.mjs <issue> <out.json>
 * Env:   OPENROUTER_API_KEY, REVIEWER_MODEL (default openai/gpt-5.6-luna),
 *        REVIEWER_EFFORT (reasoning effort, default high),
 *        OPENROUTER_BASE_URL (default https://openrouter.ai/api/v1; set
 *        https://eu.openrouter.ai/api/v1 to keep prompts in the EU, which
 *        needs an OpenRouter Business plan)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [issue, outPath] = process.argv.slice(2);
if (!issue || !outPath) {
  console.error("usage: review-external.mjs <issue> <out.json>");
  process.exit(2);
}

const model = process.env.REVIEWER_MODEL || "openai/gpt-5.6-luna";
const effort = process.env.REVIEWER_EFFORT || "high";
const baseUrl = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const key = process.env.OPENROUTER_API_KEY;
const MAX_DIFF_CHARS = 250_000;

function write(result) {
  writeFileSync(outPath, JSON.stringify(result, null, 2));
}

if (!key) {
  write({ error: "OPENROUTER_API_KEY is not set", blocking: [], non_blocking: [] });
  process.exit(0);
}

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "(missing)");
const spec = `docs/specs/${issue}`;
let diff = execFileSync(
  "git",
  ["diff", "origin/main...HEAD", "--", ".", ":(exclude)package-lock.json", ":(exclude)**/*.html"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
let truncated = false;
if (diff.length > MAX_DIFF_CHARS) {
  diff = diff.slice(0, MAX_DIFF_CHARS);
  truncated = true;
}

const system = readFileSync(fileURLToPath(new URL("./roles/reviewer-external.md", import.meta.url)), "utf8");
const user = [
  `## Implementation plan\n${read(`${spec}/plan.md`)}`,
  `## Acceptance criteria\n${read(`${spec}/criteria.md`)}`,
  `## Design notes\n${read(`${spec}/design.md`)}`,
  `## Diff${truncated ? " (truncated: review what is shown, and say the diff was too large)" : ""}\n\`\`\`diff\n${diff}\n\`\`\``,
].join("\n\n");

try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Union squad reviewer",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      reasoning: { effort },
    }),
    signal: AbortSignal.timeout(15 * 60 * 1000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  const text = body.choices?.[0]?.message?.content ?? "";
  const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  write({
    model: body.model ?? model,
    effort,
    cost_usd: body.usage?.cost ?? null,
    blocking: json.blocking ?? [],
    non_blocking: json.non_blocking ?? [],
    summary: json.summary ?? "",
    truncated,
  });
} catch (error) {
  // A failed review is reported, never silently treated as "no findings".
  write({ error: String(error), blocking: [], non_blocking: [] });
}
