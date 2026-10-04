-- ============================================================
-- The reconfirmation asks its own questions
--
-- 20260820200000 gave the couple control over the extras the RSVP
-- block asks for — dietary needs, companions' dietary needs, a
-- message — and had the reconfirmation touchpoint read the
-- primary form's map, on the reasoning that a reconfirmation *is*
-- the primary block shown later.
--
-- That reasoning holds for the two reply labels and does not hold
-- here. Labels are shared because a button's meaning must never
-- drift between touchpoints: "coming" has to mean coming in both.
-- But *which questions get asked* is the entire point of having a
-- second, later touchpoint. A couple may not want to ask about
-- meals at save-the-date time, when guests genuinely do not know,
-- and very much want to ask three weeks out. The shared map made
-- that impossible in both directions: turning dietary off for the
-- early ask silenced the late one too, and leaving it on for the
-- late one duplicated it in the early one.
--
-- So each rsvp-kind form now reads its own forms.rsvp_fields. No
-- schema change is needed — the column and its shape guard have
-- always been per row, and the constraint from 20260820200000
-- already allows any rsvp-kind form to carry a map. Only
-- get_invitation changes, plus the couple-facing wiring.
--
-- '{}' on a reconfirmation form still means "ask everything",
-- which is what those forms did before this file, so nothing
-- changes for a wedding that has not touched the setting.
-- ============================================================

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
      'area',         null,
      'country',      v_wedding.address_country
    )
    when 'partial' then jsonb_build_object(
      'line',         null,
      'postal_code',  v_wedding.address_postal_code,
      'city',         v_wedding.address_city,
      'area',         null,
      'country',      v_wedding.address_country
    )
    when 'area' then jsonb_build_object(
      'line',         null,
      'postal_code',  null,
      'city',         null,
      'area',         v_wedding.address_area,
      'country',      v_wedding.address_country
    )
    else null
  end;

  v_result := jsonb_build_object(
    'wedding', jsonb_build_object(
      'partner_one',        v_wedding.partner_one,
      'partner_two',        v_wedding.partner_two,
      'event_date',         v_wedding.event_date,
      'venue_name',         case
                              when v_wedding.address_visibility = 'full' then v_wedding.venue_name
                              else null
                            end,
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
        'label_declined',   nullif(f.rsvp_copy -> 'label_declined', 'null'::jsonb),
        'fields',           coalesce(f.rsvp_fields, '{}'::jsonb)
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
        'closes_at',  f.closes_at,
        -- This touchpoint's own extras, not the primary's. Absent
        -- key still means asked, so a reconfirmation nobody has
        -- configured asks what it always asked.
        'fields',     coalesce(f.rsvp_fields, '{}'::jsonb)
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
        'per_person', f.per_person,
        'answers',    (
          select fr.answers from public.form_responses fr
          where fr.form_id = f.id and fr.guest_id = v_guest.id
        ),
        -- One entry per relative of this guest who has answers on
        -- record, keyed by their guest id. Only this guest's own
        -- relatives: the same list they may answer for, so the
        -- payload can't leak another household's answers.
        'companion_answers', coalesce((
          select jsonb_object_agg(fr.guest_id::text, fr.answers)
          from public.form_responses fr
          where fr.form_id = f.id
            and (
              exists (
                select 1 from public.guest_relationships gr
                where gr.from_guest = v_guest.id and gr.to_guest = fr.guest_id
              )
              or exists (
                select 1 from public.guests c
                where c.id = fr.guest_id and c.added_by_guest_id = v_guest.id
              )
            )
        ), '{}'::jsonb)
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

-- ---------- arthurcoste75@gmail.com's wedding ----------
-- Same decision as 20260820200000 made for the primary RSVP,
-- applied to the late check-in: this wedding collects dietary
-- restrictions in a separate form, so neither RSVP touchpoint
-- asks for them. The message box stays on both. Written as an
-- upsert into whatever the row already holds, so a re-run is a
-- no-op and a later field's key survives.
update public.forms f
set rsvp_fields = coalesce(f.rsvp_fields, '{}'::jsonb) || jsonb_build_object(
      'dietary',           false,
      'companion_dietary', false
    )
where f.kind = 'rsvp'
  and f.purpose = 'reconfirmation'
  and f.wedding_id in (
    select w.id from public.weddings w
    where w.owner_id in (
      select u.id from auth.users u
      where lower(u.email) = 'arthurcoste75@gmail.com'
    )
  );
