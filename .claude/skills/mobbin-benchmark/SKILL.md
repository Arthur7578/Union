---
name: "mobbin-benchmark"
description: "Benchmark real-world UI patterns with Mobbin. Use for \"how do others do X\", \"benchmark\", \"références\", \"inspiration\", \"best practices for a screen or flow\", and before framing options, mocking up, or asserting a platform convention in any design work."
---

# Mobbin benchmark

The user has a Mobbin connector and wants it used by default for design work. Treat this skill as a standing instruction: call the Mobbin tools directly, without asking permission first. If the tools are deferred, load them in one ToolSearch call (`select:mcp__Mobbin__search_screens,mcp__Mobbin__search_flows,mcp__Mobbin__search_sections`). If they are not available or a call fails, say so in one line and continue without them; never invent references.

## When to search (and when not to)

Search when real examples would change the answer:
- **Standalone benchmark**: "how do others handle X", "show me examples of Y".
- **Critique**: before tagging a finding `[Convention plateforme]`, check 1 query. If the evidence supports it, tag `[Mobbin]` and link; if it contradicts you, say so and downgrade to `[Avis]`.
- **Cadrage**: before writing the Options block (find 2-3 structurally different approaches in the wild) and the Parcours block (use `search_flows` to see step count and order in real products).
- **Maquette**: before the plan, 1-2 queries on the key screen, to borrow structure, not looks.
- **UX copy**: to see how real products word a given empty state, error or paywall.

Do not search for: a quick opinion, pure accessibility or research-method questions, or surfaces Mobbin does not cover.

**Coverage limits (state them when relevant):** the tools search iOS and web only. No Android filter, no connected-TV / 10-foot UI. For TV questions, say Mobbin cannot back the claim, and use mobile/web only as a loose analogy, labelled as such.

## Which tool

| Need | Tool |
|---|---|
| One screen or component in context (paywall, profile picker, empty search) | `search_screens` |
| A multi-step journey (onboarding, checkout, cancel subscription) | `search_flows` |
| A marketing-site block (pricing, hero, footer) | `search_sections` |

## Query rules

- One screen or one journey per query. Split compound needs into separate calls.
- Describe what is visible: elements and their relationship ("paywall with monthly/annual toggle and free-trial CTA"), not adjectives ("modern", "clean").
- No negations. No platform words in the query; use the `platform` parameter. If the platform is unknown, ask once or run both.
- Name an app to filter to it ("Netflix profile picker"). For a category benchmark, run one unnamed query plus 1-2 named leaders.
- Keep `task_intent`, `output_destination` and `output_tool` identical across all calls of one task. `output_destination`: `chat` for an answer in conversation, `doc` for a spec/report, `code` for an HTML mockup, `design_tool` for a canvas.
- Budget: 2-4 calls per task. `limit` 6-10 for screens/sections, 3-5 for flows. Use `mode: "deep"` for nuanced queries, `standard` for named-app lookups. Use `exclude_screen_ids` or `page` rather than rephrasing when you need more.

## Reading results

- Look at the returned images. Never describe a screen from metadata alone.
- Discard weak matches silently; three good references beat ten approximate ones.
- Note app version/date if given: an old screenshot is weaker evidence.
- A handful of screenshots is evidence that a pattern exists and is common among the apps shown, not proof that it performs better. Say "seen in N of M examples", never "best practice" on Mobbin alone.

## Output

Always cite each screen you mention as a markdown link to its `mobbin_url`. If a result includes `ai_usage_notice`, show its text word for word as its own block after the results.

**Inside another design deliverable** (critique, cadrage, mockup): do not add a separate report. Weave 1-3 references into the relevant finding or option, tagged `[Mobbin]`.

**Standalone benchmark** (reply in the user's language; French template):

```
**En bref** — 2 phrases : le pattern dominant, et l'alternative qui mérite attention.
Périmètre : [plateforme, requêtes lancées, N écrans retenus sur M]

**Patterns observés**
| Pattern | Vu chez | Ce que ça résout | Limite / coût |
|---|---|---|---|

**Ce qui diffère vraiment** — 2-3 axes de variation (structure, nombre d'étapes, moment de l'engagement…)

**Recommandation pour notre cas** — quoi reprendre, quoi adapter, pourquoi [Mobbin] / [Avis]

**Non couvert** — ce que Mobbin ne permet pas de vérifier (TV, Android, performance réelle)
```

**Saving or embedding** (doc, slides, Notion, Figma): download from each result's `image_url` (high-res) instead of reusing the inline preview, and embed the file rather than hot-linking, since image URLs expire after 30 days. Keep the `mobbin_url` as the citation.