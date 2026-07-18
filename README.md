# Union

AI-powered wedding planning that goes beyond suggestions: negotiates with vendors, tracks every deadline, keeps couples calm and in control. For vendors: pre-qualified leads, instant quoting, and success-fee pricing — no pay-to-rank ads, just real bookings that close.

---

## What's in this repo

A monorepo (npm workspaces) for the Union product:

```
apps/
  mobile/     Expo (iOS + Android) app — Expo Router. The couple's planning app.
  web/        Next.js RSVP app — the public page guests use to reply to invites.
packages/
  shared/     @union/shared — Supabase client factory + generated DB types.
supabase/
  migrations/ SQL schema, RLS policies, and RSVP RPC functions.
```

### Current feature scope (v1)

- **Auth + onboarding** — email one-time-code sign-in (Supabase), then wedding setup.
- **Guest list + RSVP tracking** — add/edit guests, share a personal invite link,
  see live RSVP status and confirmed headcount.
- **Web RSVP** — guests open their link and accept/decline (no account needed).

Budget, checklist, and AI vendor negotiation are planned for later iterations.

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

### Web RSVP app

```bash
npm run web          # or: npm run dev --workspace apps/web
```

Open `http://localhost:3000/rsvp/<invite-token>`. Config is read from
`apps/web/.env.local`. Deploy to Vercel with root directory `apps/web`
(set the two `NEXT_PUBLIC_SUPABASE_*` env vars there), then update
`EXPO_PUBLIC_RSVP_WEB_URL` in the mobile app to the deployed URL.

### Typecheck everything

```bash
npm run typecheck
```

---

## Design

UI is driven by design tokens (`apps/mobile/theme/theme.ts` and CSS variables in
`apps/web/app/globals.css`) so the whole look can be re-skinned in one place from
the Claude Design assets. Buttons and touch targets are ≥ 48px for comfortable
mobile use.
