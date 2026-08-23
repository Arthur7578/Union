# Union

AI-powered wedding planning that goes beyond suggestions: negotiates with vendors, tracks every deadline, keeps couples calm and in control. For vendors: pre-qualified leads, instant quoting, and success-fee pricing — no pay-to-rank ads, just real bookings that close.

---

## What's in this repo

A monorepo (npm workspaces) for the Union product:

```
apps/
  mobile/     Expo (iOS + Android) app — Expo Router. The couple's planning app.
  web/        Next.js app — the couple's full planning web app + the public RSVP page.
packages/
  shared/     @union/shared — Supabase client factory + generated DB types.
supabase/
  migrations/ SQL schema, RLS policies, and RSVP RPC functions.
```

### Current feature scope (v1)

- **Auth + onboarding** — passwordless email sign-in via 8-digit code (Supabase), then wedding setup.
- **Guest list + RSVP tracking** — add/edit guests, share a personal invite link,
  see live RSVP status and confirmed headcount.
- **Web RSVP** — guests open their link and accept/decline (no account needed).
- **Optional "maybe" reply** — off by default; a couple turns it on per wedding
  and guests get a third answer for "I don't know yet". See below.
- **Web planning app** — a full responsive web version of the couple's app
  (Today, Vendors, Guests, Plan), recreated pixel-close from the Claude Design
  assets. See below.

Budget, checklist, and AI vendor negotiation are planned for later iterations.

---

## Web planning app (`apps/web`)

The web app is a true responsive web experience — **bottom tab bar on mobile, a
left sidebar on desktop** — not a phone frame. It shares the same Supabase
backend and 8-digit email code auth as the mobile app.

Routes:

- `/` — marketing landing.
- `/sign-in`, `/onboarding` — email 8-digit code auth, then wedding setup.
- `/today` — greeting, live countdown, and a live snapshot of your guests.
- `/guests` — real guest list with add/edit/detail, live RSVP stats, invite links.
- `/vendors` — vendor board, negotiation thread, add-a-vendor, and the
  "set a search in motion" / "search in progress" flow.
- `/plan` — what's next, budget, the weekend run-of-show, and plan-together.
- `/rsvp/[token]` — the public guest RSVP page (unchanged).

### Live data vs. sample data

Screens that a backend table already supports use **live Supabase data**: the
Today countdown/guest snapshot and everything under `/guests` (list, add, edit,
RSVP status, invite links).

The rest — Vendors, negotiation, budget, seating, stays, the weekend
run-of-show, collaborators — has no tables yet, so it renders from
`apps/web/lib/sample.ts`. **Every sample screen or section is marked in the UI**
so it's always obvious you're looking at a preview: a full-width notice
(`DemoBanner`) at the top of preview-only screens and a small blue **"Sample"**
pill on mocked sections of otherwise-live screens. All sample content belongs to
one demo couple (Maya & Daniel).

To promote a sample screen to live data later: add its Supabase table +
migration, swap the `lib/sample.ts` import for a real fetch, and drop the
`DemoBanner`/`SampleBadge`.

---

## The "maybe" RSVP reply

A yes/no-only RSVP makes an unsure guest guess, and a guess revised later
reaches the couple as a bare status flip with no hint the guest was ever
unsure. `weddings.allow_rsvp_maybe` gives that uncertainty somewhere honest to
live.

- **Off by default.** A third answer changes what a headcount means: a couple
  whose caterer needs a firm number by a date would rather chase an unsure
  guest than bank an unsure yes. Until they opt in, the RSVP behaves exactly as
  it did before the feature existed.
- **Turned on** under `/guests/forms/<primary RSVP form>` → *Access & rights*.
  The button's wording is a fourth named slot in `forms.rsvp_copy`
  (`label_maybe`), alongside its attending/declined siblings and translated the
  same way.
- **Guests** get the third button for themselves and for each companion — a
  party where one person is sure and another isn't is the ordinary case. A
  maybe is still asked for dietary notes; asking again later is what makes
  people stop replying.
- **Organisers** see maybes as their own count wherever RSVPs are counted, so
  the headcount reads as a range (`headcount`–`headcountMax`) rather than one
  number that can't be trusted. `headcount` still means firm yeses only. The
  existing **reconfirmation** form is the intended way to turn maybes into firm
  answers near the day.
- **Turning it off** stops new maybe replies but never rewrites ones already
  given — converting them would invent a commitment the guest never made.
  Those guests keep the status until they answer again, and both the guest
  portal and the organiser's own record still show it so it can be corrected.

The answer set lives in one place per layer: `public._rsvp_status_allowed` in
SQL (which is what actually protects the data) and
`packages/shared/src/rsvpAnswers.ts` in the apps (which keeps the UI from
offering a button the server would refuse).

---

## Backend (Supabase)

Project: **Union** (`jriyeblycrzpozjuexvr`, `eu-west-3`).

Tables: `profiles`, `weddings`, `guests`, `rsvps` — all RLS-protected and
owner-scoped. `rsvps.status` is the `rsvp_status` enum:
`pending | attending | maybe | declined`. A trigger auto-creates a `profile` on
signup. The public RSVP flow uses `SECURITY DEFINER` RPCs scoped by an
unguessable invite token, so guests never get direct table access:

- `get_invitation(token)` — invitation details for the guest.
- `submit_rsvp(token, status, dietary_notes, message)` — upserts the reply.
- `submit_companion_rsvp(token, companion_guest_id, status, dietary_notes)` —
  the same, for a partner or child the token holder may answer for.

Both submit RPCs check the reply against `_rsvp_status_allowed`, so `'maybe'`
is refused unless the wedding has opted in.

The applied SQL lives in `supabase/migrations/`. Generated TypeScript types live
in `packages/shared/src/database.types.ts` (regenerate with the Supabase CLI or
MCP after schema changes).

---

## Getting started

```bash
npm install          # install all workspaces from the repo root
```

### Mobile app (Expo Go)

```bash
npm run mobile       # or: npm run start --workspace apps/mobile
```

Then scan the QR code with **Expo Go** on your iPhone/Android device.
Config is read from `apps/mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_RSVP_WEB_URL`).

### Web app

```bash
npm run web          # or: npm run dev --workspace apps/web
```

Open `http://localhost:3000` for the planning app (sign in with an 8-digit
email code), or `http://localhost:3000/rsvp/<invite-token>` for a guest's
RSVP page. Config is read from `apps/web/.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Deploy to
Vercel with root directory `apps/web`; Supabase's Vercel integration provides
those variables plus the server-only `SUPABASE_SECRET_KEY` used to send team
invitations. Then update `EXPO_PUBLIC_RSVP_WEB_URL` in the mobile app to the
deployed URL.

### Typecheck everything

```bash
npm run typecheck
```

---

## Design

UI is driven by design tokens (`apps/mobile/theme/theme.ts`, `apps/web/lib/theme.ts`,
and CSS variables in `apps/web/app/globals.css`) so the whole look can be
re-skinned in one place from the Claude Design assets — a warm editorial palette
(Cormorant Garamond headings + Instrument Sans body, ink `#43353A`, rosewood
accent `#B07C82`). Buttons and touch targets are ≥ 44px for comfortable use.
