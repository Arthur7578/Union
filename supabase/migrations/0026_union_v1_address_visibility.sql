-- ============================================================
-- Union v1 · Structured venue address + guest-facing visibility
--
-- Splits the single freeform `venue_address` into structured parts
-- (number+street, postal code, city, area, country) so the couple can
-- choose how much of it guests see before the venue is locked in:
--
--   * hidden  — nothing but the venue name (if set) is shown
--   * partial — just postal code + city, so guests can start planning
--               travel without the exact address
--   * full    — the complete address
--
-- `venue_address` itself is left in place (unused going forward) so
-- existing rows keep whatever freeform text they already had.
-- ============================================================

create type public.address_visibility as enum ('hidden', 'partial', 'full');

alter table public.weddings
  add column if not exists address_line text,
  add column if not exists address_postal_code text,
  add column if not exists address_city text,
  add column if not exists address_area text,
  add column if not exists address_country text,
  add column if not exists address_visibility public.address_visibility not null default 'full';

-- ---------- get_invitation: gate the address by visibility ----------
-- Same function as 0025, with the flat venue_address swapped for a
-- structured `address` object whose fields are filtered server-side
-- per address_visibility — the guest's browser never receives more
-- than the couple chose to share, regardless of what the client asks
-- for.
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

  v_address := case v_wedding.address_visibility
    when 'full' then jsonb_build_object(
      'line',         v_wedding.address_line,
      'postal_code',  v_wedding.address_postal_code,
      'city',         v_wedding.address_city,
      'area',         v_wedding.address_area,
      'country',      v_wedding.address_country
    )
    when 'partial' then jsonb_build_object(
      'line',         null,
      'postal_code',  v_wedding.address_postal_code,
      'city',         v_wedding.address_city,
      'area',         null,
      'country',      v_wedding.address_country
    )
    else null
  end;

  v_result := jsonb_build_object(
    'wedding', jsonb_build_object(
      'partner_one',        v_wedding.partner_one,
      'partner_two',        v_wedding.partner_two,
      'event_date',         v_wedding.event_date,
      'venue_name',         v_wedding.venue_name,
      'address_visibility', v_wedding.address_visibility,
      'address',            v_address
    ),
    'guest', (
      select jsonb_build_object(
        'id',            v_guest.id,
        'first_name',    v_guest.first_name,
        'last_name',     v_guest.last_name,
        'age_years',     v_guest.age_years,
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
        'title',            nullif(f.rsvp_copy ->> 'title', ''),
        'subtitle',         nullif(f.rsvp_copy ->> 'subtitle', ''),
        'label_attending',  nullif(f.rsvp_copy ->> 'label_attending', ''),
        'label_declined',   nullif(f.rsvp_copy ->> 'label_declined', '')
      )
      from public.forms f
      where f.wedding_id = v_guest.wedding_id
        and f.kind = 'rsvp' and f.purpose = 'primary'
      limit 1
    ),
    'rsvp_reconfirmation', (
      select jsonb_build_object(
        'title',      nullif(f.rsvp_copy ->> 'title', ''),
        'subtitle',   nullif(f.rsvp_copy ->> 'subtitle', ''),
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
