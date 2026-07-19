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

- **Auth + onboarding** — passwordless email magic-link sign-in (Supabase), then wedding setup.
- **Guest list + RSVP tracking** — add/edit guests, share a personal invite link,
  see live RSVP status and confirmed headcount.
- **Web RSVP** — guests open their link and accept/decline (no account needed).
- **Web planning app** — a full responsive web version of the couple's app
  (Today, Vendors, Guests, Plan), recreated pixel-close from the Claude Design
  assets. See below.

Budget, checklist, and AI vendor negotiation are planned for later iterations.

---

## Web planning app (`apps/web`)

The web app is a true responsive web experience — **bottom tab bar on mobile, a
left sidebar on desktop** — not a phone frame. It shares the same Supabase
backend and magic-link email auth as the mobile app.

Routes:

- `/` — marketing landing.
- `/sign-in`, `/onboarding` — email magic-link auth, then wedding setup.
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

## Backend (Supabase)

Project: **Union** (`jriyeblycrzpozjuexvr`, `eu-west-3`).

Tables: `profiles`, `weddings`, `guests`, `rsvps` — all RLS-protected and
owner-scoped. A trigger auto-creates a `profile` on signup. The public RSVP flow
uses two `SECURITY DEFINER` RPCs scoped by an unguessable invite token, so guests
never get direct table access:

- `get_invitation(token)` — invitation details for the guest.
- `submit_rsvp(token, status, num_attending, dietary_notes, message)` — upserts the reply.

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

Open `http://localhost:3000` for the planning app (sign in with an email
magic link), or `http://localhost:3000/rsvp/<invite-token>` for a guest's
RSVP page. Config is read from `apps/web/.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Deploy to Vercel
with root directory `apps/web` (set the two `NEXT_PUBLIC_SUPABASE_*` env vars
there), then update `EXPO_PUBLIC_RSVP_WEB_URL` in the mobile app to the deployed
URL.

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
