---
name: ui-audit
description: Code-level quality checklist for a built web UI — accessibility, performance, theming, responsive behavior, anti-patterns — with a 0-4 score per dimension. Use when reviewing implemented screens (QA or design review), not for product or visual direction.
---

# UI audit checklist

`audit.md` in this folder is the audit reference from Impeccable
(https://github.com/pbakaus/impeccable, Apache License 2.0, see `LICENSE`),
copied unchanged.

How to use it in this repo:

- Use its five dimensions and their 0-4 scoring as the checklist when you review
  built screens. Guest screens are checked at phone size first.
- Ignore the parts that assume the Impeccable tool is installed: the
  `/impeccable …` command suggestions, the `impeccable` CLI and the native
  platform file (`audit.native.md`, not copied; Union is web only here).
- Report findings in the format your role asks for (for the squad,
  `review.json`), not in Impeccable's report format.
