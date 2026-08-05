-- ============================================================
-- Union v1 · Generic guest join link
--
-- Every guest today only has a personal, unguessable invite link
-- (guests.invite_token). There's no way to reach a whole group at
-- once (e.g. a WhatsApp thread with all the guests in it) with a
-- single link, since Union is multi-tenant and a link has to be
-- scoped to one wedding.
--
-- This adds a per-wedding join_code plus two anon-executable RPCs:
--   - get_wedding_by_join_code: public preview (couple + date) for
--     the /join/[code] landing page header.
--   - find_guest_by_name: resolves a first/last name (optionally
--     narrowed by phone/email) to that guest's own invite_token,
--     scoped to the one wedding. Never returns a guest list — only
--     ever a single resolved token or a status.
-- ============================================================

alter table public.weddings
  add column if not exists join_code text
    unique
    not null
    default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)),
  add column if not exists allow_name_fallback boolean not null default false;

-- ---------- get_wedding_by_join_code ----------
create or replace function public.get_wedding_by_join_code(p_join_code text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'partner_one',   w.partner_one,
    'partner_two',   w.partner_two,
    'event_date',    w.event_date,
    'venue_name',    w.venue_name,
    'allow_name_fallback', w.allow_name_fallback
  )
  from public.weddings w
  where w.join_code = lower(trim(coalesce(p_join_code, '')));
$$;

revoke all on function public.get_wedding_by_join_code(text) from public;
grant execute on function public.get_wedding_by_join_code(text) to anon, authenticated;

-- ---------- find_guest_by_name ----------
-- Matching uses the same public._guest_name_matches predicate already
-- used for self-merge candidates in get_invitation (same first name,
-- and either last name blank or matching). p_contact, when supplied,
-- narrows an ambiguous result by the guest's own email or phone digits
-- — never by revealing which candidate it is beforehand.
create or replace function public.find_guest_by_name(
  p_join_code text,
  p_first_name text,
  p_last_name text,
  p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id uuid;
  v_ids        uuid[];
  v_guest      public.guests%rowtype;
  v_first      text := nullif(trim(p_first_name), '');
  v_last       text := nullif(trim(p_last_name), '');
  v_contact    text := nullif(trim(p_contact), '');
begin
  if v_first is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select id into v_wedding_id
  from public.weddings
  where join_code = lower(trim(coalesce(p_join_code, '')))
    and allow_name_fallback = true;

  if v_wedding_id is null then
    return jsonb_build_object('status', 'invalid_link');
  end if;

  select array_agg(g.id) into v_ids
  from public.guests g
  where g.wedding_id = v_wedding_id
    and public._guest_name_matches(g.first_name, g.last_name, v_first, v_last)
    and (
      v_contact is null
      or (g.email is not null and lower(trim(g.email)) = lower(v_contact))
      or (
        nullif(regexp_replace(coalesce(g.phone, ''), '\D', '', 'g'), '') is not null
        and regexp_replace(g.phone, '\D', '', 'g') = regexp_replace(v_contact, '\D', '', 'g')
      )
    );

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;

  if array_length(v_ids, 1) > 1 then
    -- More than one candidate: only offer the contact-narrowing step
    -- when we haven't tried it yet. If a contact was already supplied
    -- and still ambiguous, don't loop them back through it again.
    if v_contact is null then
      return jsonb_build_object('status', 'ambiguous');
    else
      return jsonb_build_object('status', 'not_found');
    end if;
  end if;

  select * into v_guest from public.guests where id = v_ids[1];

  return jsonb_build_object(
    'status', 'match',
    'token', v_guest.invite_token,
    'first_name', v_guest.first_name,
    'last_name', v_guest.last_name
  );
end;
$$;

revoke all on function public.find_guest_by_name(text, text, text, text) from public;
grant execute on function public.find_guest_by_name(text, text, text, text) to anon, authenticated;
