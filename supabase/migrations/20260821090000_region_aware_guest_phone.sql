-- ============================================================
-- Union v1 · Region-aware guest phone normalisation
--
-- _normalize_guest_phone() applied French national-number rules to
-- every number that did not carry an explicit international prefix,
-- whatever the guest's country:
--
--   415-555-2671 (US, no +)    -> null           ("not found" on join)
--   07911 123456 (UK, no +)    -> null           (same)
--   0612345678 (Dutch mobile)  -> +33612345678   (a French number)
--
-- The last case is the dangerous one. find_guest_by_contact releases
-- an invite token on a phone match, so a different person who types the
-- same digits is handed that guest's identity, and a verified Auth phone
-- (+31...) can never match the row it belongs to.
--
-- The digits of a national number do not say which country they belong
-- to, so no function of the digits alone can fix this. The country has
-- to come from somewhere, and the right place is the wedding: the
-- organiser's address book is overwhelmingly one country, and anything
-- foreign is expected to carry a "+". That is the same "default region"
-- convention libphonenumber uses.
--
--   * weddings.phone_region — ISO 3166-1 alpha-2. Existing weddings are
--     set to 'FR' (the only region the old function understood), so
--     nothing that matched before stops matching. Null means "unknown":
--     national-format numbers then stay unmatched rather than guessed.
--
--   * _normalize_guest_phone(phone, region) — explicit international
--     numbers (+, 00) are canonicalised for every country. National
--     formats are interpreted only for a region it has rules for (FR,
--     NL, GB, US, CA); any other region yields null, never a guess.
--
--   * guests.phone_e164 can no longer be a generated column, because a
--     generated column cannot read weddings.phone_region. It becomes a
--     plain column kept in step by triggers (and still never trusts a
--     value written by a client).
--
-- Stored generated values are not recomputed when a function's body
-- changes, so the column is dropped and rebuilt rather than patched in
-- place; otherwise existing rows would keep the old +33 guesses.
-- ============================================================

-- ---------- weddings.phone_region ----------
alter table public.weddings
  add column if not exists phone_region text default 'FR'
    check (phone_region is null or phone_region ~ '^[A-Z]{2}$');

comment on column public.weddings.phone_region is
  'ISO 3166-1 alpha-2 country that national-format guest phone numbers (no + or 00 prefix) are read as. Null: national formats are not canonicalised. Numbers with an international prefix ignore this.';

-- ---------- normaliser ----------
-- The generated column depends on the old one-argument function, so it
-- (and its index) go first.
drop index if exists public.guests_wedding_phone_e164_idx;
alter table public.guests drop column if exists phone_e164;
drop function if exists public._normalize_guest_phone(text);

create function public._normalize_guest_phone(p_phone text, p_region text)
returns text
language sql
immutable
set search_path = ''
as $$
  with cleaned as (
    select
      coalesce(p_phone, '') as raw,
      regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits,
      upper(trim(coalesce(p_region, ''))) as region
  ),
  parsed as (
    select
      digits,
      region,
      case
        -- a "+" before the first digit: "+31 6 ...", "(+31) 6 ...", "tel:+31..."
        when raw ~ '^[^0-9]*\+' then digits
        -- "0031 6 ..."
        when digits like '00%' then substr(digits, 3)
      end as intl
    from cleaned
  )
  select case
    -- Explicit international number: valid for any country. A country code
    -- never starts with 0, and E.164 allows at most 15 digits.
    when intl is not null then
      case when intl ~ '^[1-9]' and length(intl) between 8 and 15
        then '+' || intl
      end
    when length(digits) < 8 or length(digits) > 15 then null
    -- National formats: only for a region we have rules for.
    when region = 'FR' then
      case
        when length(digits) = 11 and digits like '33%' then '+' || digits
        when length(digits) = 10 and digits ~ '^0[1-9]' then '+33' || substr(digits, 2)
        when length(digits) = 9 and digits ~ '^[1-9]' then '+33' || digits
      end
    when region = 'NL' then
      case
        when length(digits) = 10 and digits ~ '^0[1-9]' then '+31' || substr(digits, 2)
      end
    when region = 'GB' then
      case
        when length(digits) = 11 and digits ~ '^0[1-9]' then '+44' || substr(digits, 2)
      end
    when region in ('US', 'CA') then
      case
        when length(digits) = 10 and digits ~ '^[2-9][0-9]{2}[2-9]' then '+1' || digits
        when length(digits) = 11 and digits ~ '^1[2-9][0-9]{2}[2-9]' then '+' || digits
      end
    else null
  end
  from parsed;
$$;

-- Pure and side-effect free, so exposing it is harmless; the grants stay
-- as 20260812 left them.
revoke all on function public._normalize_guest_phone(text, text) from public, anon;
grant execute on function public._normalize_guest_phone(text, text)
  to authenticated, service_role;

-- ---------- guests.phone_e164 ----------
alter table public.guests add column phone_e164 text;

-- security definer: the owner's RLS view of weddings must not decide
-- whether a guest's number gets canonicalised. Always overwrites, so a
-- value written straight through the Data API cannot reach the identity
-- lookups.
create function public._guests_sync_phone_e164()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.phone_e164 := public._normalize_guest_phone(
    new.phone,
    (select w.phone_region from public.weddings w where w.id = new.wedding_id)
  );
  return new;
end;
$$;

revoke all on function public._guests_sync_phone_e164() from public, anon, authenticated;

create trigger guests_sync_phone_e164
  before insert or update of phone, wedding_id, phone_e164 on public.guests
  for each row execute function public._guests_sync_phone_e164();

-- Changing a wedding's region re-reads every guest's number.
create function public._weddings_resync_guest_phones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guests g
  set phone_e164 = public._normalize_guest_phone(g.phone, new.phone_region)
  where g.wedding_id = new.id;
  return null;
end;
$$;

revoke all on function public._weddings_resync_guest_phones() from public, anon, authenticated;

create trigger weddings_resync_guest_phones
  after update of phone_region on public.weddings
  for each row
  when (old.phone_region is distinct from new.phone_region)
  execute function public._weddings_resync_guest_phones();

-- Rebuild every stored value under the new rules.
update public.guests g
set phone_e164 = public._normalize_guest_phone(g.phone, w.phone_region)
from public.weddings w
where w.id = g.wedding_id;

create index guests_wedding_phone_e164_idx
  on public.guests (wedding_id, phone_e164)
  where phone_e164 is not null;

-- ---------- identity lookups ----------
-- Bodies are unchanged from 20260805090716_contact_first_guest_join.sql
-- except for how the phone is normalised, marked below.

-- The typed contact is read in the wedding's region.
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
  v_phone := case when not v_is_email then public._normalize_guest_phone(v_contact, v_wedding.phone_region) else null end;

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

-- A confirmed Auth phone is E.164 by construction, but GoTrue stores it
-- without the "+", so the "+" is put back and no region is consulted.
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
    case when u.phone_confirmed_at is not null then public._normalize_guest_phone('+' || u.phone, null) end
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
    case when u.phone_confirmed_at is not null then public._normalize_guest_phone('+' || u.phone, null) end
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
