-- ============================================================
-- Union v1 · Per-wedding SMS invitation template & sender.
--
-- Adds two columns on public.weddings:
--   sms_sender   — text label (up to 11 alphanumeric chars) or
--                  E.164-ish phone number used as the SMS "from".
--                  Kept optional so the SMS-invite button on the
--                  guest edit page can gate on it (organiser must
--                  configure it before we allow a send).
--   sms_template — the free-form invitation copy the organiser
--                  edits from /guests/sms-template. Supports the
--                  {{guest_first_name}}, {{guest_access_link}},
--                  {{partner_1_first_name}}, {{partner_2_first_name}}
--                  placeholders (resolved server-side on send).
--
-- Default sms_template is the French copy the product team
-- requested; the app will make it multilingual later.
-- ============================================================

alter table public.weddings
  add column if not exists sms_sender text,
  add column if not exists sms_template text not null default
    'Salut {{guest_first_name}},

Ici toutes les informations concernant notre mariage : {{guest_access_link}}.
Avec toute notre affection, {{partner_1_first_name}} & {{partner_2_first_name}}';
