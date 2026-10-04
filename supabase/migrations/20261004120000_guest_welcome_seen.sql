-- ============================================================
-- Union v1 · The invitation welcome ("faire-part")
--
-- 1. guests.welcome_seen_at: whether this guest has opened the welcome that
--    greets them before the hub. Kept server-side so it follows the guest to
--    another device. get_invitation reports it; mark_welcome_seen sets it.
--
-- 2. One rule for what a visitor may read about where the wedding is. The
--    address tiers lived inline in get_invitation while
--    get_wedding_by_join_code returned venue_name whatever the tier, so the
--    group link and a guest's own link disagreed. _wedding_address and
--    _wedding_venue_name are now the single source, and both RPCs use them.
--    NOTE: this means a group link no longer reveals the venue name when the
--    couple has not chosen the 'full' tier.
-- ============================================================

alter table public.guests
  add column if not exists welcome_seen_at timestamptz;

comment on column public.guests.welcome_seen_at is
  'When this guest first opened the invitation welcome. Null until they do; the welcome is shown once, and the guest hub can replay it.';

-- ---------- shared disclosure rules ----------
create or replace function public._wedding_address(w public.weddings)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case w.address_visibility
    when 'full' then jsonb_build_object(
      'line',         w.address_line,
      'postal_code',  w.address_postal_code,
      'city',         w.address_city,
      'area',         null,
      'country',      w.address_country
    )
    when 'partial' then jsonb_build_object(
      'line',         null,
      'postal_code',  w.address_postal_code,
      'city',         w.address_city,
      'area',         null,
      'country',      w.address_country
    )
    when 'area' then jsonb_build_object(
      'line',         null,
      'postal_code',  null,
      'city',         null,
      'area',         w.address_area,
      'country',      w.address_country
    )
    else null
  end;
$$;

create or replace function public._wedding_venue_name(w public.weddings)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when w.address_visibility = 'full' then w.venue_name else null end;
$$;

revoke all on function public._wedding_address(public.weddings) from public;
revoke all on function public._wedding_venue_name(public.weddings) from public;

-- ---------- get_invitation: same payload plus guest.welcome_seen_at ----------
create or replace function public.get_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_guest        public.guests%rowtype;
  v_wedding      public.weddings%rowtype;
  v_kids_used    int;
  v_kids_cap     int;
  v_can_partner  boolean;
  v_can_kids     boolean;
  v_address      jsonb;
  v_result       jsonb;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_wedding from public.weddings where id = v_guest.wedding_id;

  v_can_partner := coalesce(v_guest.can_add_partner, v_wedding.allow_guests_add_partner);
  v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_children);

  select count(*) into v_kids_used
  from public.guest_relationships gr
  where gr.from_guest = v_guest.id and gr.kind = 'parent_of';

  v_kids_cap := v_wedding.max_children_per_guest;

  v_address := public._wedding_address(v_wedding);

  v_result := jsonb_build_object(
    'wedding', jsonb_build_object(
      'partner_one',        v_wedding.partner_one,
      'partner_two',        v_wedding.partner_two,
      'event_date',         v_wedding.event_date,
      'venue_name',         public._wedding_venue_name(v_wedding),
      'address_visibility', v_wedding.address_visibility,
      'address',            v_address,
      'default_locale',     v_wedding.default_locale,
      'guest_modules',      coalesce(v_wedding.guest_modules, '{}'::jsonb)
    ),
    'guest', (
      select jsonb_build_object(
        'id',            v_guest.id,
        'first_name',    v_guest.first_name,
        'last_name',     v_guest.last_name,
        'age_years',     v_guest.age_years,
        'locale',        v_guest.locale,
        'chosen_locale', v_guest.chosen_locale,
        'welcome_seen_at', v_guest.welcome_seen_at,
        'rsvp_status',   coalesce(r.status, 'pending'::public.rsvp_status),
        'dietary_notes', r.dietary_notes,
        'message',       r.message
      )
      from (select v_guest.id as gid) self
      left join public.rsvps r on r.guest_id = self.gid
    ),
    'companions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',            c.id,
        'first_name',    c.first_name,
        'last_name',     c.last_name,
        'age_years',     c.age_years,
        'relationship',  gr.kind,
        'rsvp_status',   coalesce(cr.status, 'pending'::public.rsvp_status),
        'dietary_notes', cr.dietary_notes
      ) order by c.first_name)
      from public.guest_relationships gr
      join public.guests c on c.id = gr.to_guest
      left join public.rsvps cr on cr.guest_id = c.id
      where gr.from_guest = v_guest.id
    ), '[]'::jsonb),
    'permissions', jsonb_build_object(
      'can_add_partner', v_can_partner,
      'can_add_kids',    v_can_kids,
      'kids_remaining',  case
                           when not v_can_kids then 0
                           when v_kids_cap is null then null
                           else greatest(v_kids_cap - v_kids_used, 0)
                         end
    ),
    'self_merge_candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                    m.id,
        'first_name',            m.first_name,
        'last_name',             m.last_name,
        'age_years',             m.age_years,
        'added_by_first_name',   ab.first_name
      ))
      from public.guests m
      left join public.guests ab on ab.id = m.added_by_guest_id
      where m.wedding_id = v_guest.wedding_id
        and m.id <> v_guest.id
        and public._guest_matches(
              m.first_name, m.last_name, m.age_years,
              v_guest.first_name, v_guest.last_name, v_guest.age_years
            )
    ), '[]'::jsonb),
    'rsvp_form', (
      select jsonb_build_object(
        'title',            nullif(f.rsvp_copy -> 'title', 'null'::jsonb),
        'subtitle',         nullif(f.rsvp_copy -> 'subtitle', 'null'::jsonb),
        'label_attending',  nullif(f.rsvp_copy -> 'label_attending', 'null'::jsonb),
        'label_declined',   nullif(f.rsvp_copy -> 'label_declined', 'null'::jsonb)
      )
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'rsvp' and f.purpose = 'primary'
      limit 1
    ),
    'rsvp_reconfirmation', (
      select jsonb_build_object(
        'title',      nullif(f.rsvp_copy -> 'title', 'null'::jsonb),
        'subtitle',   nullif(f.rsvp_copy -> 'subtitle', 'null'::jsonb),
        'published',  f.published,
        'opens_at',   f.opens_at,
        'closes_at',  f.closes_at
      )
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'rsvp' and f.purpose = 'reconfirmation'
      limit 1
    ),
    'custom_forms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',         f.id,
        'title',      f.title,
        'guest_copy', f.guest_copy,
        'questions',  f.questions,
        'published',  f.published,
        'opens_at',   f.opens_at,
        'closes_at',  f.closes_at,
        'answers',    (
          select fr.answers from public.form_responses fr
          where fr.form_id = f.id and fr.guest_id = v_guest.id
        )
      ) order by f.sort_order, f.created_at)
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'custom'
        and f.published = true
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

revoke all on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- ---------- get_wedding_by_join_code: same disclosure as a guest's own link ----------
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

-- ---------- mark_welcome_seen ----------
-- Idempotent: the first call stamps the time, later ones change nothing.
create or replace function public.mark_welcome_seen(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.guests
     set welcome_seen_at = coalesce(welcome_seen_at, now())
   where invite_token = p_token
   returning id into v_id;
  if v_id is null then
    raise exception 'Invalid invitation token';
  end if;
  return jsonb_build_object('status', 'saved');
end;
$$;

revoke all on function public.mark_welcome_seen(uuid) from public;
grant execute on function public.mark_welcome_seen(uuid) to anon, authenticated;
