-- ============================================================
-- Union v1 · Contact-first guest access
--
-- The default group-link experience identifies a guest from contact
-- information the organiser is likely to have: email or phone. A first
-- name is requested only when that contact belongs to several guests.
-- Organisers can opt into a stronger email-OTP mode, and a guest who
-- supplies a missing email must verify it before it is saved and linked
-- as a durable Supabase Auth identity.
-- ============================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

do $$
begin
  create type public.guest_join_auth_mode as enum ('contact', 'otp');
exception
  when duplicate_object then null;
end
$$;

alter table public.weddings
  add column if not exists guest_join_auth_mode public.guest_join_auth_mode
    not null default 'contact';

-- Canonicalise explicit international numbers and common French local
-- forms. Unknown local formats stay null rather than being matched to the
-- wrong country. Raw guests.phone remains untouched for organiser display.
create or replace function public._normalize_guest_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  with cleaned as (
    select
      trim(coalesce(p_phone, '')) as raw,
      regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits
  )
  select case
    when length(digits) < 8 or length(digits) > 15 then null
    when raw like '+%' then '+' || digits
    when digits like '00%' then '+' || substr(digits, 3)
    when length(digits) = 11 and digits like '33%' then '+' || digits
    when length(digits) = 10 and digits like '0%' then '+33' || substr(digits, 2)
    when length(digits) = 9 and digits ~ '^[1-9]' then '+33' || digits
    else null
  end
  from cleaned;
$$;

revoke all on function public._normalize_guest_phone(text) from public, anon, authenticated;

alter table public.guests
  add column if not exists phone_e164 text
    generated always as (public._normalize_guest_phone(phone)) stored;

create index if not exists guests_wedding_phone_e164_idx
  on public.guests (wedding_id, phone_e164)
  where phone_e164 is not null;

create index if not exists guests_wedding_lower_email_idx
  on public.guests (wedding_id, lower(trim(email)))
  where email is not null and trim(email) <> '';

create or replace function public._normalize_guest_first_name(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      extensions.unaccent(trim(coalesce(p_name, ''))),
      '[^[:alnum:]]',
      '',
      'g'
    )
  );
$$;

revoke all on function public._normalize_guest_first_name(text) from public, anon, authenticated;

create or replace function public._guest_first_name_matches(
  p_stored text,
  p_entered text
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_stored text := public._normalize_guest_first_name(p_stored);
  v_entered text := public._normalize_guest_first_name(p_entered);
  v_limit int;
begin
  if v_stored = '' or v_entered = '' then
    return false;
  end if;
  if v_stored = v_entered then
    return true;
  end if;
  if least(length(v_stored), length(v_entered)) < 4 then
    return false;
  end if;

  v_limit := case
    when greatest(length(v_stored), length(v_entered)) <= 7 then 1
    else 2
  end;

  return abs(length(v_stored) - length(v_entered)) <= v_limit
    and extensions.levenshtein(v_stored, v_entered) <= v_limit;
end;
$$;

revoke all on function public._guest_first_name_matches(text, text) from public, anon, authenticated;

-- Public contact resolution never returns a list. In OTP mode (or when a
-- guest email is already linked to Auth) it also withholds the invite token
-- until Supabase has verified the email.
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
      or (not v_is_email and g.phone_e164 = v_phone)
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

revoke all on function public.find_guest_by_contact(text, text, text) from public;
grant execute on function public.find_guest_by_contact(text, text, text) to anon, authenticated;

-- Retire the old bare-name public lookup. Its migration stays in history,
-- but the lower-assurance endpoint is no longer part of the API surface.
revoke all on function public.find_guest_by_name(text, text, text, text) from public, anon, authenticated;

create or replace function public.get_wedding_by_join_code(p_join_code text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'partner_one', w.partner_one,
    'partner_two', w.partner_two,
    'event_date', w.event_date,
    'venue_name', w.venue_name,
    'guest_join_auth_mode', w.guest_join_auth_mode
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

revoke all on function public.get_wedding_by_join_code(text) from public;
grant execute on function public.get_wedding_by_join_code(text) to anon, authenticated;

-- Add optional first-name disambiguation after Auth. The candidate set is
-- already restricted to the verified Auth email/phone before fuzzy matching.
drop function if exists public.get_guest_access_options(text);

create function public.get_guest_access_options(
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
    case when u.phone_confirmed_at is not null then public._normalize_guest_phone(u.phone) end
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

revoke all on function public.get_guest_access_options(text, text) from public, anon;
grant execute on function public.get_guest_access_options(text, text) to authenticated;

-- Keep the final claim check on the same canonical phone representation as
-- contact discovery. This is dormant until phone OTP is configured, but
-- prevents +33 and 06 forms from behaving differently when it is enabled.
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
    case when u.phone_confirmed_at is not null then public._normalize_guest_phone(u.phone) end
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
    or (v_phone is not null and v_guest.phone_e164 = v_phone);

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

revoke all on function public.claim_guest_access(uuid) from public, anon;
grant execute on function public.claim_guest_access(uuid) to authenticated;

-- The token holder only learns whether onboarding is required; the address
-- itself is never returned by this public helper.
create or replace function public.get_guest_email_status(p_token uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'status', 'ok',
    'email_missing', nullif(trim(g.email), '') is null
  )
  from public.guests g
  where g.invite_token = p_token;
$$;

revoke all on function public.get_guest_email_status(uuid) from public;
grant execute on function public.get_guest_email_status(uuid) to anon, authenticated;

-- Verify first through Supabase Auth, then atomically save the confirmed
-- Auth email and link the guest row. A pre-existing organiser-entered email
-- is never overwritten through this onboarding endpoint.
create or replace function public.complete_guest_email_setup(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_guest public.guests%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select nullif(lower(trim(u.email)), '') into v_email
  from auth.users u
  where u.id = v_user_id and u.email_confirmed_at is not null;

  if v_email is null then
    return jsonb_build_object('status', 'email_not_verified');
  end if;

  select * into v_guest
  from public.guests
  where invite_token = p_token
  for update;

  if v_guest.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if nullif(trim(v_guest.email), '') is not null
     and lower(trim(v_guest.email)) <> v_email then
    return jsonb_build_object('status', 'email_already_set');
  end if;

  update public.guests
  set email = v_email,
      profile_id = v_user_id
  where id = v_guest.id;

  return jsonb_build_object(
    'status', 'verified',
    'guest_id', v_guest.id,
    'first_name', v_guest.first_name,
    'last_name', v_guest.last_name
  );
end;
$$;

revoke all on function public.complete_guest_email_setup(uuid) from public, anon;
grant execute on function public.complete_guest_email_setup(uuid) to authenticated;
