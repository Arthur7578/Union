-- ============================================================
-- Union v1 · Guest OTP sign-in (phone-bootstrapped, email-verified)
--
-- Adds a stronger, primary way into the guest experience alongside the
-- existing bare name search (0026's find_guest_by_name, kept as an
-- opt-in low-friction fallback via weddings.allow_name_fallback):
--
--   1. Bootstrap: name + phone (wedding-scoped) resolves to a guest row,
--      then an email is collected-or-reused and verified via a one-time
--      code — that email becomes the guest's durable sign-in credential.
--   2. Direct: an already-known email is verified via the same one-time
--      code mechanism, wedding-agnostic (the same email can legitimately
--      match guest rows on several different weddings, and this is the
--      path a future stand-alone "sign in without any link" entry point
--      would reuse as-is).
--
-- Security note: request_guest_email_otp / request_guest_otp return a
-- PLAINTEXT code to their caller so it can be emailed. If they were
-- anon-executable, any browser holding the public anon key could call
-- them directly and read the code back, skipping the email step
-- entirely. So — unlike every other RPC in this app so far — these two
-- are granted to `service_role` only, callable exclusively from the new
-- server-side API route using a service-role credential (never exposed
-- to the browser). The verify_* RPCs never return a secret, so they
-- stay anon-executable like every other guest-facing RPC.
-- ============================================================

create table public.guest_otp_codes (
  id uuid primary key default gen_random_uuid(),
  contact_key text not null,        -- lower(trim(email)) — always an email; phone is a matching key, never an OTP channel
  code_hash text not null,
  attempt_count int not null default 0,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
alter table public.guest_otp_codes enable row level security;
create index guest_otp_codes_contact_key_idx on public.guest_otp_codes (contact_key);

alter table public.weddings
  add column if not exists allow_name_fallback boolean not null default false;

-- ---------- get_wedding_by_join_code: also surface allow_name_fallback ----------
create or replace function public.get_wedding_by_join_code(p_join_code text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'partner_one',         w.partner_one,
    'partner_two',         w.partner_two,
    'event_date',          w.event_date,
    'venue_name',          w.venue_name,
    'allow_name_fallback', w.allow_name_fallback
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

-- ---------- private helpers: issue / consume a code for a contact_key ----------
-- Not directly callable by anon/authenticated — only invoked internally by
-- the SECURITY DEFINER functions below (same pattern as _guest_name_matches).
create or replace function public._issue_guest_otp(p_contact_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_requested timestamptz;
  v_recent_count   int;
  v_code           text;
begin
  select max(requested_at) into v_last_requested
  from public.guest_otp_codes
  where contact_key = p_contact_key;

  if v_last_requested is not null and v_last_requested > now() - interval '60 seconds' then
    return jsonb_build_object('status', 'cooldown');
  end if;

  select count(*) into v_recent_count
  from public.guest_otp_codes
  where contact_key = p_contact_key
    and requested_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    return jsonb_build_object('status', 'too_many_requests');
  end if;

  -- md5 (built into Postgres core, no extension dependency) is fine here —
  -- the security comes from expiry + attempt-count + cooldown, not hash
  -- strength, over a deliberately small 6-digit code space.
  v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');

  insert into public.guest_otp_codes (contact_key, code_hash, expires_at)
  values (p_contact_key, md5(p_contact_key || ':' || v_code), now() + interval '10 minutes');

  return jsonb_build_object('status', 'sent', 'code', v_code);
end;
$$;

revoke all on function public._issue_guest_otp(text) from public, anon, authenticated;

create or replace function public._consume_guest_otp(p_contact_key text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.guest_otp_codes%rowtype;
begin
  select * into v_row
  from public.guest_otp_codes
  where contact_key = p_contact_key
    and consumed_at is null
    and expires_at > now()
  order by requested_at desc
  limit 1;

  if v_row.id is null or v_row.attempt_count >= 5 then
    return false;
  end if;

  if v_row.code_hash <> md5(p_contact_key || ':' || trim(coalesce(p_code, ''))) then
    update public.guest_otp_codes set attempt_count = attempt_count + 1 where id = v_row.id;
    return false;
  end if;

  update public.guest_otp_codes set consumed_at = now() where id = v_row.id;
  return true;
end;
$$;

revoke all on function public._consume_guest_otp(text, text) from public, anon, authenticated;

-- ---------- private helper: re-resolve a single guest by name + phone ----------
-- Collapses ambiguous/not_found into a single "couldn't cleanly resolve"
-- null — by the time request/verify are called, find_guest_by_phone has
-- already told the client it was an unambiguous match; a re-resolution
-- failure here just means "start over", no need to re-distinguish why.
create or replace function public._resolve_guest_by_phone(
  p_join_code text,
  p_first_name text,
  p_last_name text,
  p_phone text
)
returns public.guests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id     uuid;
  v_ids            uuid[];
  v_guest          public.guests%rowtype;
  v_first          text := nullif(trim(p_first_name), '');
  v_last           text := nullif(trim(p_last_name), '');
  v_phone_digits   text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if v_first is null or v_phone_digits is null then
    return null;
  end if;

  select id into v_wedding_id
  from public.weddings
  where join_code = lower(trim(coalesce(p_join_code, '')));

  if v_wedding_id is null then
    return null;
  end if;

  select array_agg(g.id) into v_ids
  from public.guests g
  where g.wedding_id = v_wedding_id
    and public._guest_name_matches(g.first_name, g.last_name, v_first, v_last)
    and g.phone is not null
    and regexp_replace(g.phone, '\D', '', 'g') = v_phone_digits;

  if v_ids is null or array_length(v_ids, 1) <> 1 then
    return null;
  end if;

  select * into v_guest from public.guests where id = v_ids[1];
  return v_guest;
end;
$$;

revoke all on function public._resolve_guest_by_phone(text, text, text, text) from public, anon, authenticated;

-- ---------- find_guest_by_phone: the client-facing wedding-scoped match ----------
create or replace function public.find_guest_by_phone(
  p_join_code text,
  p_first_name text,
  p_last_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id     uuid;
  v_ids            uuid[];
  v_guest          public.guests%rowtype;
  v_first          text := nullif(trim(p_first_name), '');
  v_last           text := nullif(trim(p_last_name), '');
  v_phone_digits   text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if v_first is null or v_phone_digits is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select id into v_wedding_id
  from public.weddings
  where join_code = lower(trim(coalesce(p_join_code, '')));

  if v_wedding_id is null then
    return jsonb_build_object('status', 'invalid_link');
  end if;

  select array_agg(g.id) into v_ids
  from public.guests g
  where g.wedding_id = v_wedding_id
    and public._guest_name_matches(g.first_name, g.last_name, v_first, v_last)
    and g.phone is not null
    and regexp_replace(g.phone, '\D', '', 'g') = v_phone_digits;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;

  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('status', 'ambiguous');
  end if;

  select * into v_guest from public.guests where id = v_ids[1];

  return jsonb_build_object(
    'status', 'match',
    'has_email', (v_guest.email is not null and trim(v_guest.email) <> '')
  );
end;
$$;

revoke all on function public.find_guest_by_phone(text, text, text, text) from public;
grant execute on function public.find_guest_by_phone(text, text, text, text) to anon, authenticated;

-- ---------- request_guest_email_otp: bootstrap path, service_role only ----------
create or replace function public.request_guest_email_otp(
  p_join_code text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest        public.guests%rowtype;
  v_target_email text;
  v_issue        jsonb;
begin
  v_guest := public._resolve_guest_by_phone(p_join_code, p_first_name, p_last_name, p_phone);
  if v_guest.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_target_email := nullif(lower(trim(coalesce(p_email, v_guest.email, ''))), '');
  if v_target_email is null then
    return jsonb_build_object('status', 'email_required');
  end if;

  v_issue := public._issue_guest_otp(v_target_email);
  if (v_issue ->> 'status') <> 'sent' then
    return v_issue;
  end if;

  return jsonb_build_object(
    'status', 'sent',
    'code', v_issue ->> 'code',
    'email', v_target_email
  );
end;
$$;

revoke all on function public.request_guest_email_otp(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_guest_email_otp(text, text, text, text, text) to service_role;

-- ---------- verify_guest_email_otp: bootstrap path, anon-safe ----------
create or replace function public.verify_guest_email_otp(
  p_join_code text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_code text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest        public.guests%rowtype;
  v_target_email text;
  v_ok           boolean;
  v_has_org      boolean;
begin
  v_guest := public._resolve_guest_by_phone(p_join_code, p_first_name, p_last_name, p_phone);
  if v_guest.id is null then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  v_target_email := nullif(lower(trim(coalesce(p_email, v_guest.email, ''))), '');
  if v_target_email is null then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  v_ok := public._consume_guest_otp(v_target_email, p_code);
  if not v_ok then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  if p_email is not null then
    update public.guests set email = v_target_email where id = v_guest.id;
  end if;

  select exists(
    select 1 from auth.users u where lower(u.email) = v_target_email
  ) into v_has_org;

  return jsonb_build_object(
    'status', 'verified',
    'token', v_guest.invite_token,
    'first_name', v_guest.first_name,
    'last_name', v_guest.last_name,
    'has_organiser_account', coalesce(v_has_org, false)
  );
end;
$$;

revoke all on function public.verify_guest_email_otp(text, text, text, text, text, text) from public;
grant execute on function public.verify_guest_email_otp(text, text, text, text, text, text) to anon, authenticated;

-- ---------- request_guest_otp: direct/wedding-agnostic path, service_role only ----------
create or replace function public.request_guest_otp(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_key text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_has_match   boolean;
  v_issue       jsonb;
begin
  if v_contact_key is null then
    return jsonb_build_object('status', 'sent');
  end if;

  select exists(
    select 1 from public.guests g where lower(trim(g.email)) = v_contact_key
  ) into v_has_match;

  if not v_has_match then
    -- Never reveal whether this email belongs to any guest.
    return jsonb_build_object('status', 'sent');
  end if;

  v_issue := public._issue_guest_otp(v_contact_key);
  if (v_issue ->> 'status') <> 'sent' then
    return v_issue;
  end if;

  return jsonb_build_object(
    'status', 'sent',
    'code', v_issue ->> 'code',
    'email', v_contact_key
  );
end;
$$;

revoke all on function public.request_guest_otp(text) from public, anon, authenticated;
grant execute on function public.request_guest_otp(text) to service_role;

-- ---------- verify_guest_otp: direct/wedding-agnostic path, anon-safe ----------
create or replace function public.verify_guest_otp(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_key text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_ok          boolean;
  v_has_org     boolean;
  v_matches     jsonb;
begin
  if v_contact_key is null then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  v_ok := public._consume_guest_otp(v_contact_key, p_code);
  if not v_ok then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'wedding_partner_one', w.partner_one,
    'wedding_partner_two', w.partner_two,
    'wedding_event_date',  w.event_date,
    'token',               g.invite_token,
    'first_name',          g.first_name,
    'last_name',           g.last_name
  ) order by w.event_date nulls last), '[]'::jsonb)
  into v_matches
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  where lower(trim(g.email)) = v_contact_key;

  select exists(
    select 1 from auth.users u where lower(u.email) = v_contact_key
  ) into v_has_org;

  return jsonb_build_object(
    'status', 'verified',
    'matches', v_matches,
    'has_organiser_account', coalesce(v_has_org, false)
  );
end;
$$;

revoke all on function public.verify_guest_otp(text, text) from public;
grant execute on function public.verify_guest_otp(text, text) to anon, authenticated;
