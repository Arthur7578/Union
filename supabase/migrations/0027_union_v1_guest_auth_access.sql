-- ============================================================
-- Union v1 · Authenticated guest access
--
-- Supabase Auth owns OTP issuance, delivery, verification, rate
-- limiting, and the resulting session. These RPCs only map a
-- verified auth user to guest rows whose stored email or phone
-- matches that user's confirmed Auth identity.
--
-- One auth user may be linked to several guest rows, including
-- rows from different weddings. A user may also own or organise
-- a wedding: authentication is identity, not an application role.
-- ============================================================

-- Return the guest identities available to the current verified
-- Supabase Auth user. p_join_code scopes the group-link flow to one
-- wedding; null deliberately supports a future account-level guest
-- sign-in page spanning several weddings.
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
        'already_linked', g.profile_id = v_user_id
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
        g.profile_id is null
        and (
          (
            v_email is not null
            and g.email is not null
            and lower(trim(g.email)) = v_email
          )
          or (
            v_phone_digits is not null
            and g.phone is not null
            and nullif(regexp_replace(g.phone, '\D', '', 'g'), '') = v_phone_digits
          )
        )
      )
    );

  return jsonb_build_object('status', 'ok', 'matches', v_matches);
end;
$$;

revoke all on function public.get_guest_access_options(text) from public, anon;
grant execute on function public.get_guest_access_options(text) to authenticated;

-- Link one selected guest identity to the current auth user and return
-- the existing invite token so the current /guest/[token] experience
-- remains unchanged. The row is locked to prevent two accounts from
-- claiming the same guest concurrently.
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

  if v_guest.profile_id is not null then
    return jsonb_build_object('status', 'already_claimed');
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
