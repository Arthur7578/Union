# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Engaged couples planning their own wedding, mostly on their phone in short bursts (commute, evenings), often both partners plus co-organisers they invite. Desktop is second. Guests are a second audience: they open a personal invitation link, usually on a phone, to reply and find the practical details.

## Product Purpose

Union plans the wedding with the couple: it tracks guests and replies, seating, stays, forms and the guest invitation, and (in preview) vendors, budget and the weekend run-of-show. Success is a couple who feels calm and in control because they only have to decide, not chase.

## Positioning

Union does the work. It is an assistant that acts on the couple's behalf (negotiates with vendors, chases RSVPs, tracks deadlines) and brings back decisions, rather than a toolbox the couple has to drive.

## Operating Context

- Main surface is mobile web (bottom tab bar); desktop gets a left sidebar. The native Expo app is on hold.
- Five tabs: Today, Vendors, Union (vendor search), Guests, Plan; account area outside them.
- Guests use their own invitation portal (`/guest/[token]`), opened from a personal link or a shared group link.
- Vendors, budget, Plan overview and the weekend are sample-data previews, marked as such in the UI.

## Capabilities and Constraints

- Live: guest list, groups, relationships, duplicates, permissions, seating, stays, forms and RSVP, guest page content, SMS invitations, group link, co-organisers.
- Every screen is bilingual, English and French; French copy runs longer and layouts must hold it.
- Colours live in `lib/theme.ts` (ESLint bans hex elsewhere); styles are inline plus `app/globals.css`.

## Brand Commitments

- Bilingual EN/FR everywhere (confirmed binding).
- Not binding (confirmed): the "Union" wordmark styling, the four-point spark mark, and a separate look for the guest pages may all change.

## Evidence on Hand

No real customers, testimonials, metrics or press. Never invent them. Sample screens use authored demo data from `lib/sample.ts`, labelled as samples.

## Product Principles

1. The couple decides; Union does the legwork and shows what it did.
2. Calm over completeness: show where things stand and the one next move, not every tool at once.
3. Phone first: one-thumb reach, short visits, nothing that needs a desktop.
4. Honest state: sample data is always labelled; numbers on screen are real.
5. Theme-neutral: Union's interface never takes on a wedding style. It must not exclude any theme (bohemian, black tie, minimal, rustic…); couples should feel at the right place whatever their wedding looks like. Personality comes from the couple's own wedding (their names, date, details), not from the app. (Confirmed 2026-11-10, after a themed "garden marquee" trial read as childish and divisive.)
