---
version: 1
slug: "app-app-guests-page-tsx"
primary_target: "app/(app)/guests/page.tsx"
related_targets: ["app/(app)/guests/list/page.tsx"]
---

# Guests hub (/guests) and guest list (/guests/list)

Scope: the couple's Guests tab. Mode: Operate. Audience: an engaged couple on their phone, short visits.

Objectives:
- Hub root (/guests): tell the couple whether anything needs them on their guests, and let them act in one tap; then the way into every module. No browsing here (no list, no search).
- Guest list (/guests/list): a module like the others. Find any guest, filter by reply or missing email, open their page.

Rejected so far: Seed packet, Airmail, Admit One, Métro line; Garden marquee (childish, divisive); a per-wedding colour picker (unneeded at this stage); a black-and-white neutral frame (the user wants Union's own colours). Binding: PRODUCT.md principle 5, theme-neutral.

## Direction contract

THESIS: Union design system v2: Union's own colours (rosewood, cream, warm ink) named by role and checked for AA, one modern grotesque, calm cards. The hub root is an action list, not a dashboard.

OWN-WORLD: Union canvas (warm cream), white-cream cards with hairlines, warm ink, Hanken Grotesk, rosewood (#8A545C) for the one filled action per area, links and the selected chip; sage, dusty blue, sand and amber for Coming, Maybe, Can't and Waiting.

STORY: The couple opens Guests, sees how many have answered, then a short list of what needs them (nudge the waiting ones, guests with no email, possible duplicates, coming guests without a seat, the unsure ones), acts in one tap, or opens a module.

FIRST VIEWPORT: Title and a ghost Add button (no couple names or date: they help no task); a compact replies card (count, one split bar, legend) that opens the list; "To do" with the most pressing card first and its filled button.

FORM: Seed key 9087c69e (direction round "Your colours"), recoloured with Union's palette and restructured around actions at the user's request.

FINISH: unreviewed and unshipped until the finish reviewer returns ship.
