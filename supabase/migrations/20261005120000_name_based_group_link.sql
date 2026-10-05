-- ============================================================
-- Union v1 · Group link: guests find their invitation by name
--
-- The group link (/join/[code]) used to identify guests by the email or
-- phone number the couple had entered ("contact matching"), or by an email
-- code sent to that address. Both need contact details the couple doesn't
-- want to collect up front, and contact matching let anyone who knew a
-- guest's number (visible to every member of a WhatsApp group) open their
-- invitation. A mandatory "add your email" screen after it also let whoever
-- reached an invitation first attach their own email to it.
--
-- This replaces all of it with two modes, chosen per wedding:
--
--   secure (default)  The guest types their first name (their last name
--                     only when two or more guests share that first name),
--                     then confirms an email with a one-time code. If the
--                     couple entered an email, it has to be that one; if not,
--                     the first email confirmed secures the invitation.
--   light             The guest types their name and goes straight in. The
--                     couple accepts that anyone with the link who knows a
--                     guest's name can open that invitation.
--
-- A guest's email now records where it came from and whether the guest has
-- confirmed it, so the couple can see who can actually be reached:
--
--   guests.email_source        'organiser' | 'guest' (null with no email)
--   guests.email_confirmed_at  set once the guest proved they receive mail
--                              there (an email code); null otherwise
--
-- Retired: find_guest_by_contact (contact matching), find_guest_by_name and
-- weddings.allow_name_fallback (an older, unused name search), and
-- complete_guest_email_setup (the forced email screen).
--
-- Not in this change (logged as issue #74): the group link still ends on
-- the guest's personal link address, so someone who opened an invitation
-- keeps that address after "Reset access".
-- ============================================================

-- ---------- join modes ----------
alter table public.weddings alter column guest_join_auth_mode drop default;
-- Every wedding moves to the new default. All weddings were test data when
-- this shipped, so nobody's chosen mode is lost.
alter table public.weddings
  alter column guest_join_auth_mode type text using 'secure';
alter table public.weddings
  alter column guest_join_auth_mode set default 'secure';
alter table public.weddings
  add constraint weddings_guest_join_auth_mode_check
  check (guest_join_auth_mode in ('secure', 'light'));

comment on column public.weddings.guest_join_auth_mode is
  'How guests open their invitation from the group link: secure (name + email code) or light (name only).';

drop function if exists public.find_guest_by_contact(text, text, text);
drop function if exists public.find_guest_by_name(text, text, text, text);
drop function if exists public.complete_guest_email_setup(uuid);
drop type if exists public.guest_join_auth_mode;
alter table public.weddings drop column if exists allow_name_fallback;

-- ---------- where a guest's email came from ----------
alter table public.guests
  add column if not exists email_source text
    check (email_source in ('organiser', 'guest')),
  add column if not exists email_confirmed_at timestamptz;

comment on column public.guests.email_source is
  'Who put guests.email there: organiser (the couple or a co-organiser) or guest (the guest themselves). Null when there is no email.';
comment on column public.guests.email_confirmed_at is
  'When the guest proved they receive mail at guests.email, with an email code. Null while unconfirmed.';

update public.guests
set email_source = 'organiser'
where nullif(trim(email), '') is not null;

-- An email already linked to the account that confirmed it counts as
-- confirmed.
update public.guests g
set email_confirmed_at = u.email_confirmed_at
from auth.users u
where g.profile_id = u.id
  and u.email_confirmed_at is not null
  and nullif(trim(g.email), '') is not null
  and lower(trim(g.email)) = lower(trim(u.email));

-- Any write that changes the address resets its provenance. The guest-facing
-- functions below say they are writing on the guest's behalf through a
-- transaction-local setting; everything else (the guest form, guest import,
-- merges) is the organiser. A change of case or spacing is not a change.
create or replace function public._guest_email_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_writer text := nullif(current_setting('union.guest_email_writer', true), '');
begin
  if nullif(trim(coalesce(new.email, '')), '') is null then
    new.email_source := null;
    new.email_confirmed_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and lower(trim(new.email)) = lower(trim(coalesce(old.email, ''))) then
    return new;
  end if;

  if v_writer = 'guest' then
    new.email_source := 'guest';
  else
    new.email_source := 'organiser';
    new.email_confirmed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public._guest_email_provenance() from public, anon, authenticated;

drop trigger if exists guests_email_provenance on public.guests;
create trigger guests_email_provenance
  before insert or update of email on public.guests
  for each row execute function public._guest_email_provenance();

-- ---------- rate limit for the public name search ----------
-- Counted per wedding and per client address, in Postgres rather than in
-- the app: the browser calls these RPCs directly. The address comes from
-- the request headers PostgREST exposes. Requests without one share a
-- bucket with a higher limit, so they can't lock real guests out.
create table if not exists union_private.join_lookup_attempts (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  client_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (wedding_id, client_key, window_start)
);

alter table union_private.join_lookup_attempts enable row level security;
revoke all on union_private.join_lookup_attempts from public, anon, authenticated;

create or replace function union_private.take_join_lookup(p_wedding_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers jsonb := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
  v_key text := coalesce(
    nullif(trim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(trim(v_headers ->> 'x-real-ip'), ''),
    'unknown'
  );
  v_window timestamptz := date_bin('10 minutes', now(), timestamptz '2000-01-01 00:00:00+00');
  v_limit integer := case when v_key = 'unknown' then 300 else 30 end;
  v_hits integer;
begin
  insert into union_private.join_lookup_attempts as a
    (wedding_id, client_key, window_start, hits)
  values (p_wedding_id, v_key, v_window, 1)
  on conflict (wedding_id, client_key, window_start)
    do update set hits = a.hits + 1
  returning a.hits into v_hits;

  delete from union_private.join_lookup_attempts
  where wedding_id = p_wedding_id
    and window_start < now() - interval '1 day';

  return v_hits <= v_limit;
end;
$$;

revoke all on function union_private.take_join_lookup(uuid) from public, anon, authenticated;

-- ---------- find_guest_for_join ----------
-- Names are compared exactly after normalisation (case, accents, spaces,
-- hyphens and punctuation ignored), never fuzzily: "Maria" must not open
-- "Marie". The last name is only asked for, and only used, when two or more
-- guests share the first name. Never returns a list of guests.
--
-- secure mode returns the guest's id, which opens nothing by itself: the
-- caller still has to confirm an email and call secure_guest_invitation.
-- light mode returns the invitation token.
create or replace function public.find_guest_for_join(
  p_join_code text,
  p_first_name text,
  p_last_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding public.weddings%rowtype;
  v_first text := public._normalize_guest_first_name(p_first_name);
  v_last text := public._normalize_guest_first_name(p_last_name);
  v_ids uuid[];
  v_guest public.guests%rowtype;
begin
  select * into v_wedding
  from public.weddings
  where join_code = lower(trim(coalesce(p_join_code, '')));

  if v_wedding.id is null then
    return jsonb_build_object('status', 'invalid_link');
  end if;
  if not union_private.take_join_lookup(v_wedding.id) then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if v_first = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select array_agg(g.id order by g.id) into v_ids
  from public.guests g
  where g.wedding_id = v_wedding.id
    and public._normalize_guest_first_name(g.first_name) = v_first;

  if v_ids is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if array_length(v_ids, 1) > 1 then
    if v_last = '' then
      return jsonb_build_object('status', 'needs_last_name');
    end if;

    select array_agg(g.id order by g.id) into v_ids
    from public.guests g
    where g.id = any (v_ids)
      and public._normalize_guest_first_name(g.last_name) = v_last;

    if v_ids is null then
      return jsonb_build_object('status', 'not_found');
    end if;
    if array_length(v_ids, 1) > 1 then
      -- Same first and last name: only the couple can tell them apart.
      return jsonb_build_object('status', 'ambiguous');
    end if;
  end if;

  select * into v_guest from public.guests where id = v_ids[1];

  if v_wedding.guest_join_auth_mode = 'light' then
    return jsonb_build_object(
      'status', 'match',
      'mode', 'light',
      'token', v_guest.invite_token
    );
  end if;

  return jsonb_build_object(
    'status', 'match',
    'mode', 'secure',
    'guest_id', v_guest.id
  );
end;
$$;

revoke all on function public.find_guest_for_join(text, text, text) from public;
grant execute on function public.find_guest_for_join(text, text, text) to anon, authenticated;

-- ---------- check_join_email ----------
-- Before a code is sent: would confirming this email open this guest's
-- invitation? Saves sending a code that can't work, and tells the guest
-- why. secure_guest_invitation repeats every check after the code.
create or replace function public.check_join_email(
  p_join_code text,
  p_guest_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id uuid;
  v_guest public.guests%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  select id into v_wedding_id
  from public.weddings
  where join_code = lower(trim(coalesce(p_join_code, '')));

  if v_wedding_id is null then
    return jsonb_build_object('status', 'invalid_link');
  end if;
  if not union_private.take_join_lookup(v_wedding_id) then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('status', 'invalid_email');
  end if;

  select * into v_guest
  from public.guests
  where id = p_guest_id and wedding_id = v_wedding_id;

  if v_guest.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if nullif(trim(v_guest.email), '') is not null then
    if lower(trim(v_guest.email)) = v_email then
      return jsonb_build_object('status', 'ok');
    end if;
    if v_guest.email_source = 'guest' or v_guest.profile_id is not null then
      return jsonb_build_object('status', 'already_secured');
    end if;
    return jsonb_build_object('status', 'email_mismatch');
  end if;

  if v_guest.profile_id is not null then
    return jsonb_build_object('status', 'already_secured');
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.check_join_email(text, uuid, text) from public;
grant execute on function public.check_join_email(text, uuid, text) to anon, authenticated;

-- ---------- secure_guest_invitation ----------
-- Called with a session whose email Supabase Auth has confirmed (the email
-- code). Links the guest to that account and returns their invitation:
--   * already linked to this account: yes;
--   * the couple entered an email: only if it is this one, and it is now
--     marked confirmed;
--   * no email on file and nobody linked: the first confirmed email secures
--     the invitation and becomes the guest's email.
create or replace function public.secure_guest_invitation(
  p_join_code text,
  p_guest_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_wedding_id uuid;
  v_guest public.guests%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select nullif(lower(trim(u.email)), '') into v_email
  from auth.users u
  where u.id = v_user_id and u.email_confirmed_at is not null;

  select id into v_wedding_id
  from public.weddings
  where join_code = lower(trim(coalesce(p_join_code, '')));

  if v_wedding_id is null then
    return jsonb_build_object('status', 'invalid_link');
  end if;

  select * into v_guest
  from public.guests
  where id = p_guest_id and wedding_id = v_wedding_id
  for update;

  if v_guest.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_guest.profile_id is distinct from v_user_id then
    if v_email is null then
      return jsonb_build_object('status', 'email_not_confirmed');
    end if;

    if nullif(trim(v_guest.email), '') is not null then
      if lower(trim(v_guest.email)) <> v_email then
        return jsonb_build_object(
          'status',
          case
            when v_guest.email_source = 'guest' or v_guest.profile_id is not null
              then 'already_secured'
            else 'email_mismatch'
          end
        );
      end if;
      -- The confirmed owner of the email on file is authoritative, even over
      -- an older account link.
      update public.guests
      set profile_id = v_user_id,
          email_confirmed_at = coalesce(email_confirmed_at, now())
      where id = v_guest.id;
    elsif v_guest.profile_id is not null then
      return jsonb_build_object('status', 'already_secured');
    else
      perform set_config('union.guest_email_writer', 'guest', true);
      update public.guests
      set email = v_email,
          email_confirmed_at = now(),
          profile_id = v_user_id
      where id = v_guest.id;
      perform set_config('union.guest_email_writer', '', true);
    end if;
  elsif v_email is not null
        and lower(trim(coalesce(v_guest.email, ''))) = v_email
        and v_guest.email_confirmed_at is null then
    update public.guests
    set email_confirmed_at = now()
    where id = v_guest.id;
  end if;

  return jsonb_build_object(
    'status', 'verified',
    'token', v_guest.invite_token,
    'guest_id', v_guest.id,
    'first_name', v_guest.first_name,
    'last_name', v_guest.last_name
  );
end;
$$;

revoke all on function public.secure_guest_invitation(text, uuid) from public, anon;
grant execute on function public.secure_guest_invitation(text, uuid) to authenticated;

-- ---------- set_guest_email ----------
-- A guest gives an email from their invitation (when they reply). Never
-- replaces one already on file: only the couple can change it, so nobody can
-- swap another guest's address. Saved as given by the guest, unconfirmed.
create or replace function public.set_guest_email(p_token uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    return jsonb_build_object('status', 'invalid_email');
  end if;

  select * into v_guest
  from public.guests
  where invite_token = p_token
  for update;

  if v_guest.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if nullif(trim(v_guest.email), '') is not null then
    return jsonb_build_object(
      'status',
      case when lower(trim(v_guest.email)) = v_email then 'ok' else 'email_already_set' end
    );
  end if;

  perform set_config('union.guest_email_writer', 'guest', true);
  update public.guests set email = v_email where id = v_guest.id;
  perform set_config('union.guest_email_writer', '', true);

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.set_guest_email(uuid, text) from public;
grant execute on function public.set_guest_email(uuid, text) to anon, authenticated;

-- ---------- reset_guest_access ----------
-- For the couple, when the wrong person secured an invitation: unlinks the
-- account and removes an email the guest gave. An email the couple entered
-- stays. The invitation's own link is unchanged (see issue #74).
create or replace function public.reset_guest_access(p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
begin
  select * into v_guest from public.guests where id = p_guest_id for update;

  if v_guest.id is null or not union_private.can_access_wedding(v_guest.wedding_id) then
    return jsonb_build_object('status', 'not_found');
  end if;

  update public.guests
  set profile_id = null,
      email = case when email_source = 'guest' then null else email end
  where id = v_guest.id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.reset_guest_access(uuid) from public, anon;
grant execute on function public.reset_guest_access(uuid) to authenticated;

-- ---------- get_wedding_by_join_code ----------
-- Unchanged apart from the mode now being text. Recreated so the definition
-- matches the new column type.
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
    'venue_name', public._wedding_venue_name(w),
    'address_visibility', w.address_visibility,
    'address', public._wedding_address(w),
    'guest_join_auth_mode', w.guest_join_auth_mode,
    'default_locale', w.default_locale
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

revoke all on function public.get_wedding_by_join_code(text) from public;
grant execute on function public.get_wedding_by_join_code(text) to anon, authenticated;
