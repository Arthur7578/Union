# Union

AI-powered wedding planning that goes beyond suggestions: negotiates with vendors, tracks every deadline, keeps couples calm and in control. For vendors: pre-qualified leads, instant quoting, and success-fee pricing — no pay-to-rank ads, just real bookings that close.

---

## What's in this repo

A monorepo (npm workspaces, Node 22) for the Union product:

```
apps/
  mobile/     Expo (iOS + Android) app — Expo Router. The couple's planning app.
              ⏸ Development is paused for now (see below); web is the active app.
  web/        Next.js app — the couple's full planning web app, the guest
              invitation portal, and a few API routes.
packages/
  shared/     @union/shared — Supabase client factory, generated DB types, and
              shared domain logic (guest modules, guest permissions, localized
              text, form questions).
supabase/
  migrations/ SQL schema, RLS policies, and RPC functions.
  templates/  Auth email templates (sign-in code / co-organiser invite).
  tests/      SQL tests, run with `supabase test db`.
```

### Current feature scope

- **Auth + onboarding** — passwordless email sign-in via 8-digit code (Supabase),
  then wedding setup. Accounts with several weddings get a picker.
- **Guest list** — add/edit guests, groups & roles, partner/child relationships,
  duplicate detection and merge, and per-guest permission overrides.
- **Seating and stays** — seating tables (plus ceremony layout) and room blocks.
- **Invitations** — each guest gets a personal link to their invitation portal
  (RSVP, companions, the couple's forms, travel, logistics, FAQ); a generic group
  link lets guests find their own invitation; invites can be sent by SMS (Brevo).
- **Forms** — the couple builds custom forms, words the RSVP block, and can add a
  late "still coming?" reconfirmation. Guest-facing copy is written per language,
  with optional machine translation (needs `ANTHROPIC_API_KEY`).
- **Plan together** — invite co-organisers by email.
- **English and French** UI, and an installable PWA (web manifest + offline page).

The vendor board, vendor search/negotiation, budget, and weekend run-of-show exist
as **sample-data previews only** — see [Live data vs. sample data](#live-data-vs-sample-data).

---

## Web planning app (`apps/web`)

The web app is a true responsive web experience — **bottom tab bar on mobile, a
left sidebar on desktop** — not a phone frame. It shares the same Supabase
backend and 8-digit email code auth as the mobile app. It has **41 pages** and
**3 API routes**.

The five nav tabs are Today, Vendors, Union (vendor search), Guests and Plan. The
account area (`/account/*`) sits outside them.

"Data" below is **Live** (real Supabase data), **Sample** (preview content from
`apps/web/lib/sample.ts`), **Redirect**, or **Static**.

### Public and sign-in routes

| Route | What it is | Data |
| --- | --- | --- |
| `/` | Marketing landing; signed-in visitors get an "Open Union" CTA. | Static |
| `/sign-in` | Email 8-digit code sign-in. | Live |
| `/onboarding` | First-wedding setup. | Live |
| `/choose-wedding` | Picker for accounts with more than one wedding. Sends you to `/onboarding` if you have none. | Live |
| `/invitation` | Where an emailed co-organiser invite lands (`?wedding=<id>`): offers the invited wedding first, then any others. | Live |
| `/accept-invite` | Hop in front of Supabase's one-time auth link. The auth email templates link here with `#confirmation_url=…`; the page checks the link points at this project's `/auth/v1/verify`, remembers the invited wedding, then follows it. | Live |
| `/guest/[token]` | **The guest page.** A guest's invitation portal, opened from their personal invite link (`token` = the guest's invite token). Handles RSVP, companions, the wedding's custom forms, and the travel / logistics / FAQ tabs (each can be switched off per wedding). Opens in the guest's language. `/guest/demo` renders a demo invitation with no database. | Live |
| `/join/[code]` | The wedding's generic group link (`code` = `weddings.join_code`). The guest identifies themselves — by contact details (default) or an emailed code — and lands on their own `/guest/[token]`. | Live |
| `/rsvp/[token]` | Legacy alias. A ~15-line redirect to `/guest/[token]`. Kept because links sent before the move still use `/rsvp/<token>`; nothing emits it any more (links are built with `guestLinkPath` / `guestLinkUrl` from `@union/shared`). Don't build on it. | Redirect |
| `/offline` | Offline fallback page, precached by the service worker. | Static |

### App routes (`/today`, `/guests`, `/vendors`, `/plan`, `/account`)

| Route | What it is | Data |
| --- | --- | --- |
| `/today` | Greeting, live countdown, and a snapshot of your guests. The "needs you today", "Union is handling" and "just closed" sections are sample. | Live + Sample |
| `/guests` | Guest list with live RSVP stats and invite links. | Live |
| `/guests/new` | Add a guest, with links to existing relatives or new ones created inline. | Live |
| `/guests/[id]` | Guest detail and edit, including per-guest permission overrides. | Live |
| `/guests/groups` | Groups & roles. | Live |
| `/guests/duplicates` | Possible duplicate guests, with merge review. | Live |
| `/guests/seating` | Seating tables and ceremony layout. | Live |
| `/guests/stays` | Room blocks. | Live |
| `/guests/forms` | Forms hub: the RSVP form and the couple's custom forms. | Live |
| `/guests/forms/[id]` | Form builder, including per-language copy and optional auto-translate. | Live |
| `/guests/rsvp-form` | Redirect to the Forms hub, so old links and bookmarks keep working. | Redirect |
| `/guests/sms-template` | The invitation SMS template, sender, and the wedding's own Brevo key. | Live |
| `/guests/modules` | Turn guest-portal sections on or off (forms, travel, logistics, FAQ). At least one must stay on. | Live |
| `/guests/permissions` | Wedding-level defaults for what a guest can do from their invite: add a partner, add children, and a cap on children. | Live |
| `/guests/group-link` | Share the generic `/join/[code]` link (copy / WhatsApp) and choose how guests identify themselves: contact details or an emailed code. | Live |
| `/vendors` | Vendor board. | Sample |
| `/vendors/new` | Add a vendor. | Sample |
| `/vendors/[id]` | Vendor detail and negotiation thread. | Sample |
| `/vendors/search` | Start a vendor search ("set a search in motion"). | Sample |
| `/vendors/search/active` | A search in progress. | Sample |
| `/plan` | What's next (this week / book soon / later), with entry points to budget, weekend and plan-together. | Sample |
| `/plan/budget` | Budget. | Sample |
| `/plan/weekend` | Weekend run-of-show. | Sample |
| `/plan/team` | "Plan together": invite and manage co-organisers. | Live |
| `/account` | Account home. The Union Plus and billing rows are sample. | Live + Sample |
| `/account/profile` | Your profile. | Live |
| `/account/wedding` | Your wedding's details. | Live |
| `/account/settings` | Settings. | Sample |
| `/account/settings/notifications` | Notification preferences. | Sample |
| `/account/privacy` | Privacy information. | Static |
| `/account/feedback` | Help & feedback — opens the UserJot panel. | Static |

### API routes

All three are `POST` and take the caller's Supabase access token as
`Authorization: Bearer <token>`.

| Route | What it does | Config |
| --- | --- | --- |
| `/api/invite-collaborator` | Saves a co-organiser invite (wedding owner only) and emails it through Supabase Auth. People with an existing account get the ordinary sign-in email; creating a brand-new Auth user needs the server-only secret key. If the email can't be sent, the invite row is still kept and the response says so. | `SUPABASE_SECRET_KEY` for new users; optionally `NEXT_PUBLIC_SITE_URL` |
| `/api/send-sms` | Sends a guest their invitation SMS through Brevo, using the wedding's own Brevo key and sender (stored on the wedding, not in env). | none |
| `/api/translate` | Translates form copy between English and French for the form builder. Writes nothing — the couple reviews and saves the result. Returns `503` with a readable message if no key is configured. | `ANTHROPIC_API_KEY`; optionally `ANTHROPIC_TRANSLATE_MODEL` |

> **Keeping this list honest.** Route counts drift quickly. To re-check:
> `find apps/web/app -name page.tsx | wc -l` (pages) and
> `find apps/web/app/api -name route.ts` (API routes).

### Live data vs. sample data

Everything marked **Live** above reads and writes Supabase: guests and groups,
relationships and duplicates, seating, stays, forms, SMS settings, wedding and
profile, and the co-organiser team.

The rest — Vendors, vendor search and negotiation, the Plan overview, budget, the
weekend run-of-show, account settings and notification preferences, plus a few
sections of Today and Account — has no backing tables yet, so it renders from
`apps/web/lib/sample.ts`. **Every sample screen or section is marked in the UI**
so it's always obvious you're looking at a preview: a full-width notice
(`DemoBanner`) at the top of preview-only screens and a small blue **"Sample"**
pill on mocked sections of otherwise-live screens. All sample content belongs to
one demo couple (Maya & Daniel).

To promote a sample screen to live data later: add its Supabase table +
migration, swap the `lib/sample.ts` import for a real fetch, and drop the
`DemoBanner`/`SampleBadge`.

---

## Backend (Supabase)

Project: **Union** (`jriyeblycrzpozjuexvr`, `eu-west-3`).

Tables: `profiles`, `weddings`, `guests`, `rsvps`, `guest_groups`,
`guest_group_members`, `guest_relationships`, `hidden_merge_clusters`,
`seating_tables`, `room_blocks`, `forms`, `form_responses`,
`wedding_collaborators`, `activity_log` — all RLS-protected. A wedding's owner and
its accepted collaborators can work with its data. A trigger auto-creates a
`profile` on signup.

Guests never get direct table access. The public invitation flow goes through
`SECURITY DEFINER` RPCs, scoped by an unguessable invite token (or, for the group
link, the wedding's join code). The ones callable without signing in are:

- `get_invitation(token)` — invitation details for the guest.
- `submit_rsvp(…)` — upserts the guest's reply.
- `submit_companion_rsvp(…)`, `rsvp_register_companion(…)`, `rsvp_merge_into(…)` —
  RSVPs for a guest's companions, and merging a self-registered duplicate.
- `submit_form_response(…)` — answers to the couple's custom forms.
- `set_guest_locale(…)` — the guest's chosen language.
- `get_wedding_by_join_code(code)` and `find_guest_by_contact(code, contact, first_name)`
  — the group-link lookup.
- `get_guest_email_status(token)` — whether a guest still needs an email on file.

Organiser-only RPCs (`create_guest_with_links`, `find_duplicate_groups`,
`owner_merge_guests`, `list_collaborators`, `accept_pending_invites`, …) and the
signed-in guest-access RPCs (`get_guest_access_options`, `claim_guest_access`,
`complete_guest_email_setup`) require an authenticated user.

The applied SQL lives in `supabase/migrations/`. Generated TypeScript types live
in `packages/shared/src/database.types.ts` (regenerate with the Supabase CLI or
MCP after schema changes). Sign-in and invite emails use the templates in
`supabase/templates/`; for the hosted project, mirror them in the Supabase
dashboard (see `supabase/config.toml`).

---

## Getting started

```bash
npm install          # install all workspaces from the repo root
```

### Mobile app (Expo Go)

> **Status: paused.** No new mobile work is planned for the time being; web is
> the active app. The mobile app is kept compiling — CI still runs lint,
> typecheck and tests across every workspace, and it still consumes
> `@union/shared` — but it is not kept feature-level or visually in sync with
> web. Its theme (`apps/mobile/theme/theme.ts`) still carries the "awaiting
> final design assets" note and differs from web's palette, and its i18n
> dictionaries are deliberately separate from web's.

```bash
npm run mobile       # or: npm run start --workspace apps/mobile
```

Then scan the QR code with **Expo Go** on your iPhone/Android device.
Config is read from `apps/mobile/.env` (see `apps/mobile/.env.example`):
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
`EXPO_PUBLIC_RSVP_WEB_URL` — the web app's origin, used to build the invite links
the mobile app shares (`<EXPO_PUBLIC_RSVP_WEB_URL>/guest/<token>`).

### Web app

```bash
npm run web          # or: npm run dev --workspace apps/web
```

Open `http://localhost:3000` for the planning app (sign in with an 8-digit email
code), `http://localhost:3000/guest/<invite-token>` for a guest's invitation, or
`http://localhost:3000/guest/demo` for a demo invitation that needs no data.

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill it in. The
Supabase URL and a key are **required**: there is no built-in default project.
`npm run build` fails, naming what is missing or malformed, and `npm run dev`
without them shows a "not configured" notice instead of the app.

| Variable | Scope | Needed for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | **Required.** Supabase project URL, used by both the browser and the API routes so they always talk to the same project. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | **Required** (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the publishable key wins if both are set). Supabase publishable key. |
| `SUPABASE_SECRET_KEY` | **server-only** | `/api/invite-collaborator`, to email an invite to someone with no Union account yet (it creates the Auth user). Bypasses RLS — never expose it to the browser. Legacy `SUPABASE_SERVICE_ROLE_KEY` also works. Without it, invites to people who already have an account still send. |
| `ANTHROPIC_API_KEY` | **server-only** | `/api/translate`, the form builder's auto-translate. Optional: without it that route returns `503` and the builder asks the couple to write the other language by hand. Nothing else depends on it. |
| `ANTHROPIC_TRANSLATE_MODEL` | **server-only** | Optional. Pins the model `/api/translate` uses. Unset, the route uses the **newest Opus your key can list** (re-checked hourly, and logged when it changes), so a new Opus release is picked up without a code change; if listing fails it falls back to a built-in default (`FALLBACK_MODEL` in `apps/web/lib/translationModel.ts`). Pin it when price and behaviour must stay put. Redeploy to apply a change. If the model isn't found, the route answers `502` with a message saying so. |
| `NEXT_PUBLIC_SITE_URL` | server | Optional. Canonical origin used for the redirect link in invite emails. Supabase only honours allow-listed redirect targets, so set it where the request's own host isn't one. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | browser | Optional. Cloudflare Turnstile **site key** for sign-up bot protection (see below). Unset, no challenge runs and no token is sent. Inlined at build time, so redeploy after changing it. |
| `NEXT_PUBLIC_CONTENTSQUARE_CLIENT_ID` | browser | Optional Contentsquare analytics. Loads only in a production build when `NEXT_PUBLIC_VERCEL_ENV` is `production`. |
| `NEXT_PUBLIC_VERCEL_ENV` | browser | Gate for the analytics above. Provided by Vercel when system environment variables are exposed to the build; if it's unset, analytics stay off. |

SMS needs no env var: each wedding stores its own Brevo API key and sender in its
SMS template settings.

**Bot protection on sign-up (optional).** Sign-up and sign-in are the same email-code
flow, so the web app can run an invisible Cloudflare Turnstile challenge when someone
asks for a code (sign-in, the guest join link, guest email setup, and co-organiser
invites). It only becomes visible if Cloudflare can't vouch for the visitor. To turn
it on, in this order:

1. Create a Turnstile widget in Cloudflare (Managed mode) and copy its site key and secret.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for each Vercel environment and redeploy.
3. In the Supabase dashboard, enable **Authentication → Bot and Abuse Protection →
   CAPTCHA protection**, pick Turnstile and paste the secret.

Step 3 applies to the whole Supabase project. **The Expo app does not send a CAPTCHA
token yet**, so once it is on, mobile sign-in is rejected until the app is updated.

Deploying to Vercel: use the **repo root** as the project's root directory, not
`apps/web`. The repo-root `vercel.json` sets the install, build (lint + build) and
output paths for `apps/web`, and production builds run from the root with exactly
those commands. Set `NEXT_PUBLIC_SUPABASE_URL` and a publishable key for every
environment you build (Production and Preview) — the build fails without them.
Supabase's Vercel integration can provide the key and `SUPABASE_SECRET_KEY`, but
check that `NEXT_PUBLIC_SUPABASE_URL` is present for each environment. Then
update `EXPO_PUBLIC_RSVP_WEB_URL` in the mobile app to the deployed URL.

### Checks

CI (`.github/workflows/ci.yml`) runs all of these; run them from the repo root:

```bash
npm run lint
npm run typecheck
npm test                           # Vitest, in apps/web
npm run build --workspace apps/web
supabase test db                   # SQL tests; needs the Supabase CLI and `supabase start`
```

---

## Design

UI is driven by design tokens (`apps/web/lib/theme.ts`, `apps/mobile/theme/theme.ts`,
and CSS variables in `apps/web/app/globals.css`) so the whole look can be
re-skinned in one place from the Claude Design assets — a warm editorial palette
(Cormorant Garamond headings + Instrument Sans body, ink `#43353A`, rosewood
accent `#B07C82`). Buttons and touch targets are ≥ 44px for comfortable use.

On web, `T` in `apps/web/lib/theme.ts` is the signed-in app's palette and `G`
is the separate palette of the public guest pages (RSVP, guest portal, join
flow). Inline colours (hex, `rgb()`/`hsl()`/`oklch()`/`color-mix()`, or a named
colour such as `white`) are not allowed outside that file — ESLint
(`no-restricted-syntax` in `apps/web/eslint.config.mjs`) fails on them, so add a
token (or reuse a close one) instead; use `T.white` for white and
`alpha(T.ink, 0.1)` for a translucent colour. `transparent`, `currentColor` and
`inherit` are allowed, and so are the words `green`/`blue`, which components use
as tone keys; the rule can't tell those from CSS colours, so spell those two as
tokens. `apps/web/app/globals.css` has no colour literals either: it
reads CSS variables that `CSS_VARS` in the theme file defines and `app/layout.tsx`
sets on `<html>`, and `lib/theme.test.ts` fails if a literal or an undefined
variable appears there. The web and mobile themes are intentionally not
shared — they are differently shaped (mobile also carries spacing, radius and
type scales; web is one flat object of colours and font stacks), and only `surface`/`surfaceAlt`
overlap by name, with different values.
