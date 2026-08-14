-- ============================================================
-- Union v1 · Guest join access fixes
--
-- 1. Name fallback was still calling _guest_name_matches, which
--    migration 0014 replaced with the age-aware _guest_matches.
-- 2. A guest's profile_id must not permanently block the currently
--    verified invitation contact. Organisers can correct a guest's
--    email after an earlier account was linked; verifying the current
--    email transfers the link to that Auth user.
-- ============================================================

create or replace function public.find_guest_by_name(
  p_join_code text,
  p_first_name text,
  p_last_name text default null,
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
    and public._guest_matches(
      g.first_name,
      g.last_name,
      g.age_years,
      v_first,
      v_last,
      null
    )
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
    if v_contact is null then
      return jsonb_build_object('status', 'ambiguous');
    end if;
    return jsonb_build_object('status', 'not_found');
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

create or replace function public.get_guest_access_options(
  p_join_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id      uuid := auth.uid();
  v_email        text;
  v_phone_digits text;
  v_matches      jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated', 'matches', '[]'::jsonb);
  end if;

  select
    case
      when u.email_confirmed_at is not null then nullif(lower(trim(u.email)), '')
      else null
    end,
    case
      when u.phone_confirmed_at is not null
        then nullif(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), '')
      else null
    end
  into v_email, v_phone_digits
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
        'access_status', case
          when g.profile_id = v_user_id then 'linked'
          else 'claimable'
        end
      )
      order by w.event_date nulls last, g.first_name, g.last_name
    ),
    '[]'::jsonb
  )
  into v_matches
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  where (
      p_join_code is null
      or w.join_code = lower(trim(p_join_code))
    )
    and (
      g.profile_id = v_user_id
      or (
        v_email is not null
        and g.email is not null
        and lower(trim(g.email)) = v_email
      )
      or (
        v_phone_digits is not null
        and g.phone is not null
        and nullif(regexp_replace(g.phone, '\D', '', 'g'), '') = v_phone_digits
      )
    );

  return jsonb_build_object('status', 'ok', 'matches', v_matches);
end;
$$;

revoke all on function public.get_guest_access_options(text) from public, anon;
grant execute on function public.get_guest_access_options(text) to authenticated;

create or replace function public.claim_guest_access(p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_email        text;
  v_phone_digits text;
  v_guest        public.guests%rowtype;
  v_contact_ok   boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select
    case
      when u.email_confirmed_at is not null then nullif(lower(trim(u.email)), '')
      else null
    end,
    case
      when u.phone_confirmed_at is not null
        then nullif(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), '')
      else null
    end
  into v_email, v_phone_digits
  from auth.users u
  where u.id = v_user_id;

  select *
  into v_guest
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
    or (
      v_phone_digits is not null
      and v_guest.phone is not null
      and nullif(regexp_replace(v_guest.phone, '\D', '', 'g'), '') = v_phone_digits
    );

  if not v_contact_ok then
    return jsonb_build_object('status', 'not_available');
  end if;

  -- The verified contact currently stored on the invitation is the
  -- authority. This also repairs stale links after an organiser changes
  -- an invitation's email or phone.
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
