-- ============================================================
-- Union v1 · Explicit guest identity selection
--
-- A verified contact can appear on several guest rows. Return every
-- contact match so the UI can explain the full situation instead of
-- silently entering the only currently claimable row. Rows already
-- linked to another Auth account stay visible but cannot be claimed.
-- ============================================================

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
          when g.profile_id is null then 'claimable'
          else 'linked_elsewhere'
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
