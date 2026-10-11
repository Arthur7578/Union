-- ============================================================
-- Union v1 · A guest phone number has to state its country
--
-- _normalize_guest_phone() applied French national-number rules to
-- every number without an explicit international prefix, whatever the
-- guest's country:
--
--   415-555-2671 (US, no +)    -> null           ("not found" on join)
--   07911 123456 (UK, no +)    -> null           (same)
--   0612345678 (Dutch mobile)  -> +33612345678   (a French number)
--
-- The last case is the dangerous one. find_guest_by_contact releases an
-- invite token on a phone match, so a different person who types the
-- same digits is handed that guest's identity, and a verified Auth phone
-- (+31...) can never match the row it belongs to.
--
-- The digits of a national number do not say which country they belong
-- to, and a wedding's guests come from many countries, so no function
-- of the digits (or of the wedding) can fix this. Only the person who
-- typed the number knows. The apps now capture it with a country picker
-- and store E.164; the database stops guessing:
--
--   * phone_e164 is set only for a number that states its country: a
--     "+", or a "00" prefix. National formats give null. A bracketed
--     trunk digit, "+33 (0)6 ...", is dropped (it was kept before, which
--     produced +330...).
--
--   * Nothing is read as French any more, on either side. A number saved
--     before the picker existed, in national format, keeps its text in
--     guests.phone untouched but has no canonical form, so it matches
--     nothing by phone until someone re-saves it with a country (the
--     guest form shows a note on such a number). To list them:
--
--       select id, wedding_id from public.guests
--       where nullif(trim(phone), '') is not null and phone_e164 is null;
--
--   * A contact typed without a country is "not found". The web join form
--     always sends E.164.
--
-- Stored generated values are not recomputed when a function's body
-- changes, so phone_e164 is dropped and rebuilt rather than patched in
-- place; otherwise existing rows would keep the old +33 guesses.
-- ============================================================

-- The generated column depends on the function body, so it (and its
-- index) go first.
drop index if exists public.guests_wedding_phone_e164_idx;
alter table public.guests drop column if exists phone_e164;

-- Explicit international numbers only.
create or replace function public._normalize_guest_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  with cleaned as (
    select
      coalesce(p_phone, '') as raw,
      -- "+33 (0)6 ...": the bracketed 0 is the optional trunk digit and
      -- is not part of the number.
      regexp_replace(
        regexp_replace(coalesce(p_phone, ''), '\(\s*0\s*\)', '', 'g'),
        '\D', '', 'g'
      ) as digits
  ),
  parsed as (
    select
      case
        -- a "+" before the first digit: "+31 6 ...", "(+31) 6 ...", "tel:+31..."
        when raw ~ '^[^0-9]*\+' then digits
        -- "0031 6 ..."
        when digits like '00%' then substr(digits, 3)
      end as intl
    from cleaned
  )
  select case
    -- A country code never starts with 0, and E.164 allows at most 15
    -- digits.
    when intl ~ '^[1-9]' and length(intl) between 8 and 15 then '+' || intl
  end
  from parsed;
$$;

-- A generated column is recomputed as the writing role, so the helper
-- must stay executable by `authenticated` (20260812 fixed exactly this
-- failure). Pure and side-effect free, so exposing it is harmless.
revoke all on function public._normalize_guest_phone(text) from public, anon;
grant execute on function public._normalize_guest_phone(text)
  to authenticated, service_role;

alter table public.guests
  add column phone_e164 text
    generated always as (public._normalize_guest_phone(phone)) stored;

comment on column public.guests.phone_e164 is
  'Canonical E.164 form of guests.phone, set only when the stored number states its country (+ or 00 prefix). Null for a national-format number: its country is unknown.';

create index guests_wedding_phone_e164_idx
  on public.guests (wedding_id, phone_e164)
  where phone_e164 is not null;

-- ---------- verified Auth phone ----------
-- find_guest_by_contact needs no change: it already compares the
-- normalised typed contact with phone_e164, and now simply never turns a
-- number with no country into a match.
--
-- A confirmed Auth phone is E.164 by construction, but GoTrue stores it
-- without the "+" (the old normaliser only coped because of a "33..."
-- special case), so the "+" is put back.
--
-- claim_guest_access also had a hole that predates this migration: it
-- compared the caller's phone with a guest's phone_e164, and when that was
-- null the comparison came out null instead of false, which skipped the
-- "not_available" rejection. A caller with any confirmed phone could claim
-- any guest with no canonical phone, email-only guests included. It is
-- closed below. Otherwise the bodies are unchanged from
-- 20260805090716_contact_first_guest_join.sql.
create or replace function public.get_guest_access_options(
  p_join_code text default null,
  p_first_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_phone text;
  v_first text := nullif(trim(p_first_name), '');
  v_matches jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated', 'matches', '[]'::jsonb);
  end if;

  select
    case when u.email_confirmed_at is not null then nullif(lower(trim(u.email)), '') end,
    case when u.phone_confirmed_at is not null then public._normalize_guest_phone('+' || u.phone) end
  into v_email, v_phone
  from auth.users u
  where u.id = v_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'guest_id', g.id,
        'first_name', g.first_name,
        'last_name', g.last_name,
        'wedding_partner_one', w.partner_one,
        'wedding_partner_two', w.partner_two,
        'wedding_event_date', w.event_date,
        'access_status', case when g.profile_id = v_user_id then 'linked' else 'claimable' end
      )
      order by w.event_date nulls last, g.first_name, g.last_name
    ),
    '[]'::jsonb
  ) into v_matches
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  where (p_join_code is null or w.join_code = lower(trim(p_join_code)))
    and (
      g.profile_id = v_user_id
      or (v_email is not null and g.email is not null and lower(trim(g.email)) = v_email)
      or (v_phone is not null and g.phone_e164 = v_phone)
    )
    and (v_first is null or public._guest_first_name_matches(g.first_name, v_first));

  return jsonb_build_object('status', 'ok', 'matches', v_matches);
end;
$$;

create or replace function public.claim_guest_access(p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_phone text;
  v_guest public.guests%rowtype;
  v_contact_ok boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select
    case when u.email_confirmed_at is not null then nullif(lower(trim(u.email)), '') end,
    case when u.phone_confirmed_at is not null then public._normalize_guest_phone('+' || u.phone) end
  into v_email, v_phone
  from auth.users u
  where u.id = v_user_id;

  select * into v_guest
  from public.guests
  where id = p_guest_id
  for update;

  if v_guest.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_guest.profile_id = v_user_id then
    return jsonb_build_object(
      'status', 'verified',
      'token', v_guest.invite_token,
      'first_name', v_guest.first_name,
      'last_name', v_guest.last_name
    );
  end if;

  -- coalesce: a caller with a confirmed phone and a guest whose phone_e164
  -- is null makes the phone comparison null, not false, and `if not null`
  -- does not fire, so the rejection below was skipped and the guest was
  -- handed to the caller. Any email-only guest was claimable that way.
  v_contact_ok := coalesce(
    (
      v_email is not null
      and v_guest.email is not null
      and lower(trim(v_guest.email)) = v_email
    )
    or (v_phone is not null and v_guest.phone_e164 = v_phone),
    false
  );

  if not v_contact_ok then
    return jsonb_build_object('status', 'not_available');
  end if;

  -- The currently verified contact is authoritative. Re-linking here keeps
  -- access open if an older Union account was attached to this guest row.
  update public.guests
  set profile_id = v_user_id
  where id = v_guest.id;

  return jsonb_build_object(
    'status', 'verified',
    'token', v_guest.invite_token,
    'first_name', v_guest.first_name,
    'last_name', v_guest.last_name
  );
end;
$$;
