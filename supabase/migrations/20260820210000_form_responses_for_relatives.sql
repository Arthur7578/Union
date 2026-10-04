-- ============================================================
-- Answering a form for the people you're bringing
--
-- The RSVP block has always worked on a household: a guest
-- replies for themselves and then, in the same modal, for the
-- partner and children they're bringing — rsvps rows for each,
-- written through submit_companion_rsvp against the one
-- invitation token.
--
-- Custom forms never did. `form_responses` is unique on
-- (form_id, guest_id) and submit_form_response resolved the
-- guest from the token, so exactly one person per invitation
-- could ever answer. For anything asked per person — a meal
-- choice, an allergy, a child's menu — that is the wrong shape:
-- the parent holding the invitation had one box to describe
-- four people's dinners, and the caterer got a paragraph
-- instead of a headcount per dish.
--
-- Two changes, both narrow:
--
--   * forms.per_person says whether this form is asked once per
--     person or once per household. It is a real question for
--     the organiser, not a default to guess at: a song request
--     is a household answer, a meal choice is not. Off by
--     default, which is exactly how every form written before
--     this behaved. 'rsvp' forms don't carry it — the RSVP
--     block is per person by construction.
--
--   * submit_form_response takes an optional target guest, and
--     accepts it only for someone the token holder may already
--     answer for: their own relative, on a form that actually
--     asks per person. The authorisation rule is lifted from
--     submit_companion_rsvp rather than reinvented, so "who may
--     answer for whom" has one definition in this database and
--     not two that can drift.
--
-- Storage needs nothing new. A relative is a guests row, so
-- their answers are a form_responses row like anyone else's —
-- which also means they surface on that person's own page in
-- the organiser app with no extra work, and a child who is
-- later given their own invitation keeps the answers already
-- given for them.
-- ============================================================

-- ---------- forms.per_person ----------
alter table public.forms
  add column if not exists per_person boolean not null default false;

comment on column public.forms.per_person is
  'True when this custom form is asked once per person — the guest answers for themselves and for each relative they are bringing. False (the default) is one answer per invitation. Meaningless for rsvp-kind forms, which are per person by construction.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'forms_per_person_custom_only'
  ) then
    alter table public.forms
      add constraint forms_per_person_custom_only
      check (kind = 'custom' or per_person = false);
  end if;
end
$$;

-- ---------- submit_form_response ----------
-- Dropped and recreated rather than given a fourth argument on
-- top of the old signature: two overloads reachable from
-- PostgREST would make a three-argument call ambiguous, and the
-- default keeps existing three-argument callers working against
-- this one function.
drop function if exists public.submit_form_response(uuid, uuid, jsonb);

create or replace function public.submit_form_response(
  p_token uuid,
  p_form_id uuid,
  p_answers jsonb,
  p_for_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest   public.guests%rowtype;
  v_form    public.forms%rowtype;
  v_target  public.guests%rowtype;
  v_allowed boolean;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_form from public.forms where id = p_form_id;
  if v_form.id is null or v_form.wedding_id <> v_guest.wedding_id then
    raise exception 'Unknown form';
  end if;
  if v_form.kind <> 'custom' then
    raise exception 'This form does not accept free-form responses';
  end if;
  if not v_form.published then
    raise exception 'This form is not open yet';
  end if;
  if v_form.opens_at is not null and now() < v_form.opens_at then
    raise exception 'This form is not open yet';
  end if;
  if v_form.closes_at is not null and now() > v_form.closes_at then
    raise exception 'This form is closed';
  end if;

  -- Whose answers these are. Null (and one's own id) is the
  -- ordinary case; anything else has to be a relative of the
  -- token holder, on a form that asks per person.
  if p_for_guest_id is null or p_for_guest_id = v_guest.id then
    v_target := v_guest;
  else
    if not v_form.per_person then
      raise exception 'This form is answered once per invitation';
    end if;

    select * into v_target from public.guests where id = p_for_guest_id;
    if v_target.id is null or v_target.wedding_id <> v_guest.wedding_id then
      raise exception 'Unknown guest';
    end if;

    -- Same rule as submit_companion_rsvp: someone you are linked
    -- to, or someone you added yourself. The coalesce is the whole
    -- guard: added_by_guest_id is null for every guest the couple
    -- imported themselves, and `null = v_guest.id` is null, not
    -- false — so an uncoalesced expression makes v_allowed null,
    -- `not null` is null, and the raise below never fires. See the
    -- submit_companion_rsvp fix at the end of this migration.
    select exists (
      select 1
      from public.guest_relationships gr
      where gr.from_guest = v_guest.id and gr.to_guest = v_target.id
    ) or coalesce(v_target.added_by_guest_id = v_guest.id, false)
    into v_allowed;

    if not v_allowed then
      raise exception 'Not authorised to answer for this guest';
    end if;
  end if;

  insert into public.form_responses (form_id, guest_id, answers)
  values (p_form_id, v_target.id, coalesce(p_answers, '{}'::jsonb))
  on conflict (form_id, guest_id)
  do update set answers = excluded.answers, submitted_at = now();

  return jsonb_build_object('status', 'saved', 'guest_id', v_target.id);
end;
$$;

revoke all on function public.submit_form_response(uuid, uuid, jsonb, uuid) from public;
grant execute on function public.submit_form_response(uuid, uuid, jsonb, uuid) to anon, authenticated;

-- ---------- get_invitation: whose answers are already in ----------
-- A per-person form has to open showing what has already been
-- said for each relative, not a blank page that silently
-- overwrites it on save.
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

-- ---------- submit_companion_rsvp: close the same hole ----------
-- Found while mirroring this function's authorisation rule into
-- submit_form_response above, and fixed here rather than left
-- behind a correct copy of itself.
--
-- The rule reads "someone you are linked to, or someone you added
-- yourself", written as:
--
--     select exists (...) or v_target.added_by_guest_id = v_guest.id
--     into v_allowed;
--
-- added_by_guest_id is null for every guest the couple imported —
-- which is most of a guest list — so for an unrelated guest the
-- expression is `false or null`, i.e. null. v_allowed is null,
-- `if not v_allowed` is null rather than true, and the raise never
-- fires: any guest holding a valid invitation link could submit an
-- RSVP, and dietary notes, for any *other* guest of the same
-- wedding as long as nobody had added that guest through the
-- portal. Overwriting a stranger's reply is a real reply the couple
-- then plans a wedding around.
--
-- Only that one expression changes; the rest is 0011's function
-- verbatim, so a genuine companion (linked, or added by this
-- guest) behaves exactly as before.
create or replace function public.submit_companion_rsvp(
  p_token uuid,
  p_companion_guest_id uuid,
  p_status text,
  p_dietary_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest      public.guests%rowtype;
  v_companion  public.guests%rowtype;
  v_status     public.rsvp_status;
  v_allowed    boolean;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_companion from public.guests where id = p_companion_guest_id;
  if v_companion.id is null or v_companion.wedding_id <> v_guest.wedding_id then
    raise exception 'Unknown companion';
  end if;

  if p_status not in ('attending', 'declined') then
    raise exception 'Status must be attending or declined';
  end if;
  v_status := p_status::public.rsvp_status;

  select exists (
    select 1
    from public.guest_relationships gr
    where gr.from_guest = v_guest.id and gr.to_guest = v_companion.id
  ) or coalesce(v_companion.added_by_guest_id = v_guest.id, false)
  into v_allowed;

  if not v_allowed then
    raise exception 'Not authorised to answer for this guest';
  end if;

  insert into public.rsvps (guest_id, status, dietary_notes, responded_at)
  values (v_companion.id, v_status, p_dietary_notes, now())
  on conflict (guest_id) do update
    set status        = excluded.status,
        dietary_notes = excluded.dietary_notes,
        responded_at  = now();

  return jsonb_build_object('status', 'ok', 'guest_id', v_companion.id);
end;
$$;

revoke all on function public.submit_companion_rsvp(uuid, uuid, text, text) from public;
grant execute on function public.submit_companion_rsvp(uuid, uuid, text, text) to anon, authenticated;
