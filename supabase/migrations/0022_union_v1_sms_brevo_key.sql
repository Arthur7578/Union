-- ============================================================
-- Union v1 · Per-wedding Brevo API key for SMS invitations.
--
-- Sending real SMS requires a Brevo account with an SMS credits
-- add-on purchased — that's a per-organiser expense, not something
-- the platform should carry on a shared key. So each wedding now
-- brings its own Brevo transactional-SMS API key, stored here and
-- read server-side by /api/send-sms instead of a platform-wide
-- BREVO_API_KEY env var.
--
-- Stays a plain text column: RLS already restricts weddings rows to
-- their owner (see 0001's "Weddings selectable/updatable by owner"
-- policies) and this key is never selected back to the client after
-- save — see the sms-template settings page, which only asks
-- "is one configured?" via a boolean, not the value itself.
-- ============================================================

alter table public.weddings
  add column if not exists sms_brevo_api_key text;
