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
--   * Numbers saved before the picker existed have no stated country.
--     Rather than lose them (a French guest entered as 06 12 34 56 78
--     would stop being findable by phone) or rewrite organiser data,
--     their old French reading is kept in its own column,
--     phone_e164_legacy_fr. It is filled only while phone_e164 is null,
--     so a number that states its country never uses it, and the
--     assumption is visible and countable:
--
--       select count(*) from public.guests
--       where phone_e164_legacy_fr is not null;
--
--     Once that reaches zero, drop the column and the second branch of
--     the three lookups below.
--
--   * The typed side never guesses: a contact typed without a country
--     is "not found", not read as French.
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

-- What the system did before this migration to a number with no stated
-- country: read it as French. Used only to keep already-saved numbers
-- findable (see the header); never applied to anything typed by a guest.
create or replace function public._legacy_french_phone_reading(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    -- A "+" or "00" states a country, even when the number after it is
    -- malformed. Never reinterpret that as French.
    when raw ~ '^[^0-9]*\+' or digits like '00%' then null
    when length(digits) < 8 or length(digits) > 15 then null
    when length(digits) = 11 and digits like '33%' then '+' || digits
    when length(digits) = 10 and digits ~ '^0[1-9]' then '+33' || substr(digits, 2)
    when length(digits) = 9 and digits ~ '^[1-9]' then '+33' || digits
  end
  from (
    select
      coalesce(p_phone, '') as raw,
      regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits
  ) d;
$$;

-- A generated column is recomputed as the writing role, so both helpers
-- must stay executable by `authenticated` (20260812 fixed exactly this
-- failure). Pure and side-effect free, so exposing them is harmless.
revoke all on function public._normalize_guest_phone(text) from public, anon;
grant execute on function public._normalize_guest_phone(text)
  to authenticated, service_role;
revoke all on function public._legacy_french_phone_reading(text) from public, anon;
grant execute on function public._legacy_french_phone_reading(text)
  to authenticated, service_role;

alter table public.guests
  add column phone_e164 text
    generated always as (public._normalize_guest_phone(phone)) stored;

alter table public.guests
  add column phone_e164_legacy_fr text
    generated always as (
      case
        when public._normalize_guest_phone(phone) is null
          then public._legacy_french_phone_reading(phone)
      end
    ) stored;

comment on column public.guests.phone_e164 is
  'Canonical E.164 form of guests.phone, set only when the stored number states its country (+ or 00 prefix).';
comment on column public.guests.phone_e164_legacy_fr is
  'French reading of a guests.phone that states no country. Legacy compatibility only: filled while phone_e164 is null, matched by the contact lookups, and to be dropped once no row needs it.';

create index guests_wedding_phone_e164_idx
  on public.guests (wedding_id, phone_e164)
  where phone_e164 is not null;

create index guests_wedding_phone_e164_legacy_fr_idx
  on public.guests (wedding_id, phone_e164_legacy_fr)
  where phone_e164_legacy_fr is not null;

-- ---------- identity lookups ----------
-- Bodies are unchanged from 20260805090716_contact_first_guest_join.sql
-- except for how the phone is matched, marked below. The typed contact
-- is read as a number only if it states its country (the apps always
-- send E.164); a stored number matches on its stated country or, failing
-- that, on its legacy French reading.
create or replace function public.find_guest_by_contact(
  p_join_code text,
  p_contact text,
  p_first_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding public.weddings%rowtype;
  v_contact text := nullif(trim(p_contact), '');
  v_first text := nullif(trim(p_first_name), '');
  v_is_email boolean;
  v_email text;
  v_phone text;
  v_ids uuid[];
  v_guest public.guests%rowtype;
begin
  select * into v_wedding
  from public.weddings
  where join_code = lower(trim(coalesce(p_join_code, '')));

  if v_wedding.id is null then
    return jsonb_build_object('status', 'invalid_link');
  end if;
  if v_contact is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_is_email := position('@' in v_contact) > 1;
  v_email := case when v_is_email then lower(v_contact) else null end;
  v_phone := case when not v_is_email then public._normalize_guest_phone(v_contact) else null end;

  if v_wedding.guest_join_auth_mode = 'otp' and not v_is_email then
    return jsonb_build_object('status', 'email_required');
  end if;
  if not v_is_email and v_phone is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select array_agg(g.id order by g.id) into v_ids
  from public.guests g
  where g.wedding_id = v_wedding.id
    and (
      (v_is_email and g.email is not null and lower(trim(g.email)) = v_email)
      or (not v_is_email and (g.phone_e164 = v_phone or g.phone_e164_legacy_fr = v_phone))
    )
    and (v_first is null or public._guest_first_name_matches(g.first_name, v_first));

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('status', 'ambiguous');
  end if;

  select * into v_guest from public.guests where id = v_ids[1];

  if v_wedding.guest_join_auth_mode = 'otp'
     or (v_is_email and v_guest.profile_id is not null) then
    return jsonb_build_object('status', 'otp_required');
  end if;

  return jsonb_build_object(
    'status', 'match',
    'token', v_guest.invite_token
  );
end;
$$;

-- A confirmed Auth phone is E.164 by construction, but GoTrue stores it
-- without the "+", so the "+" is put back.
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
      or (v_phone is not null and (g.phone_e164 = v_phone or g.phone_e164_legacy_fr = v_phone))
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

  v_contact_ok :=
    (
      v_email is not null
      and v_guest.email is not null
      and lower(trim(v_guest.email)) = v_email
    )
    or (v_phone is not null and (v_guest.phone_e164 = v_phone or v_guest.phone_e164_legacy_fr = v_phone));

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
