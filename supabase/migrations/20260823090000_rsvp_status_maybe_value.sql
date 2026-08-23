-- ============================================================
-- Union v1 · 'maybe' becomes a real RSVP answer
--
-- A yes/no-only RSVP forces a guess. Guests who don't yet know
-- pick the answer that feels safest and quietly change their
-- mind later — which is the worst outcome for the couple, since
-- a silent flip between "attending" and "declined" carries no
-- signal that the guest was ever unsure.
--
-- 'maybe' gives that uncertainty somewhere honest to live, so
-- organisers can plan a range instead of discovering the truth
-- three weeks out.
--
-- This migration only widens the enum. Everything that reads or
-- writes the new value lands in the next one, because a value
-- added by ALTER TYPE cannot be referenced until the adding
-- transaction has committed.
-- ============================================================

alter type public.rsvp_status add value if not exists 'maybe' after 'attending';
