-- ============================================================
-- Union v1 — localized guest-facing form copy
--
-- Everything the couple writes for a guest to read becomes a
-- locale-keyed jsonb object instead of a single string, so one
-- form can greet an English guest with "Your presence" and a
-- French one with "Votre présence":
--
--     "Your presence"  ->  {"en": "Your presence"}
--
-- Covers forms.rsvp_copy (the RSVP block's headline, supporting
-- line and the two reply-button labels) and forms.questions
-- (each question title and each choice label).
--
-- Three structural changes come with it:
--
--   * forms.questions options stop being a bare string list and
--     become {id, label} objects. A guest's stored answer is the
--     option *id* from now on, never the label — otherwise the
--     same choice would land in two different buckets depending
--     on which language the guest replied in, and translating a
--     label would orphan every answer already given. Existing
--     answers are remapped below before the labels move.
--
--   * forms.guest_copy (new) holds a custom form's guest-facing
--     headline. forms.title stays organiser-only for every kind
--     of form. Left empty it falls back to forms.title, which is
--     exactly what guests saw before this migration — so nothing
--     changes for a form nobody has translated yet.
--
--   * guests.locale (new) records the language the couple knows
--     a guest reads, so their portal opens in it instead of
--     whatever their browser happens to advertise.
--
-- 'en' is the assumed source language for text written before
-- this migration: the app had no way to ask, and its own default
-- locale is English. A row that was actually written in French
-- still renders — readers fall back across every locale present
-- rather than showing an empty headline — and the couple can
-- correct it from the form builder.
-- ============================================================

-- ---------- guests.locale ----------
alter table public.guests
  add column if not exists locale text
    check (locale is null or locale in ('en', 'fr'));

comment on column public.guests.locale is
  'Preferred language for this guest''s portal and messages. Null means "we do not know" — fall back to the browser''s Accept-Language.';

-- ---------- forms.guest_copy ----------
alter table public.forms
  add column if not exists guest_copy jsonb not null default '{}'::jsonb;

comment on column public.forms.guest_copy is
  'Guest-facing copy for a custom form: {"title": {"en": ..., "fr": ...}, "subtitle": {...}}. Blank title falls back to forms.title.';

comment on column public.forms.rsvp_copy is
  'Guest-facing copy for the RSVP block, locale-keyed per slot: {"title": {"en": ..., "fr": ...}, "label_attending": {...}, ...}. A blank slot means "use the system default", which is where attending/declined semantics live.';

-- ============================================================
-- Remap stored answers from option labels to option ids.
--
-- Runs BEFORE the questions themselves are rewritten, so the old
-- label -> position mapping is still readable. Option ids are
-- 'o' || position, matching legacyOptionId() in the app, which is
-- what makes this remap a pure lookup instead of needing a
-- temporary id table.
--
-- Only single/multi answers are touched — short and comment
-- answers are the guest's own prose and stay untouched. A label
-- that matches no option (the couple reworded a choice after
-- someone answered) is left exactly as it was: a stale string is
-- recoverable, a silently dropped answer is not.
-- ============================================================
do $$
declare
  v_response  record;
  v_question  jsonb;
  v_answers   jsonb;
  v_answer    jsonb;
  v_options   jsonb;
  v_idx       int;
  v_mapped    jsonb;
  v_item      jsonb;
begin
  for v_response in
    select fr.form_id, fr.guest_id, fr.answers, f.questions
    from public.form_responses fr
    join public.forms f on f.id = fr.form_id
    where jsonb_typeof(fr.answers) = 'object'
      and jsonb_typeof(f.questions) = 'array'
  loop
    v_answers := v_response.answers;

    for v_question in select * from jsonb_array_elements(v_response.questions)
    loop
      -- Only choice questions whose options are still bare strings.
      if (v_question ->> 'kind') not in ('single', 'multi') then
        continue;
      end if;
      v_options := v_question -> 'options';
      if jsonb_typeof(v_options) <> 'array' then
        continue;
      end if;
      if jsonb_typeof(v_options -> 0) <> 'string' then
        continue;  -- already migrated
      end if;

      v_answer := v_answers -> (v_question ->> 'id');
      if v_answer is null then
        continue;
      end if;

      if jsonb_typeof(v_answer) = 'string' then
        select ord - 1 into v_idx
        from jsonb_array_elements_text(v_options) with ordinality as o(label, ord)
        where o.label = (v_answer #>> '{}')
        limit 1;
        if v_idx is not null then
          v_answers := jsonb_set(
            v_answers,
            array[v_question ->> 'id'],
            to_jsonb('o' || v_idx::text)
          );
        end if;

      elsif jsonb_typeof(v_answer) = 'array' then
        v_mapped := '[]'::jsonb;
        for v_item in select * from jsonb_array_elements(v_answer)
        loop
          v_idx := null;
          if jsonb_typeof(v_item) = 'string' then
            select ord - 1 into v_idx
            from jsonb_array_elements_text(v_options) with ordinality as o(label, ord)
            where o.label = (v_item #>> '{}')
            limit 1;
          end if;
          v_mapped := v_mapped || (
            case when v_idx is not null
              then to_jsonb('o' || v_idx::text)
              else v_item
            end
          );
        end loop;
        v_answers := jsonb_set(v_answers, array[v_question ->> 'id'], v_mapped);
      end if;
    end loop;

    if v_answers <> v_response.answers then
      update public.form_responses
      set answers = v_answers
      where form_id = v_response.form_id
        and guest_id = v_response.guest_id;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- Localize forms.rsvp_copy — each slot's string becomes {"en": ...}.
-- Slots already holding an object are left alone, so re-running
-- this migration is a no-op.
-- ============================================================
update public.forms f
set rsvp_copy = (
  select coalesce(jsonb_object_agg(
    slot.key,
    case
      when jsonb_typeof(slot.value) = 'string' and length(btrim(slot.value #>> '{}')) > 0
        then jsonb_build_object('en', slot.value #>> '{}')
      when jsonb_typeof(slot.value) = 'object'
        then slot.value
      else null
    end
  ) filter (
    where (jsonb_typeof(slot.value) = 'string' and length(btrim(slot.value #>> '{}')) > 0)
       or jsonb_typeof(slot.value) = 'object'
  ), '{}'::jsonb)
  from jsonb_each(f.rsvp_copy) as slot
)
where jsonb_typeof(f.rsvp_copy) = 'object'
  and exists (
    select 1 from jsonb_each(f.rsvp_copy) as slot
    where jsonb_typeof(slot.value) = 'string'
  );

-- ============================================================
-- Localize forms.questions — titles become {"en": ...}, options
-- become [{"id": "o0", "label": {"en": ...}}, ...].
-- ============================================================
update public.forms f
set questions = (
  select coalesce(jsonb_agg(
    q.value
      || jsonb_build_object(
           'title',
           case
             when jsonb_typeof(q.value -> 'title') = 'string'
               then jsonb_build_object('en', q.value ->> 'title')
             when jsonb_typeof(q.value -> 'title') = 'object'
               then q.value -> 'title'
             else '{}'::jsonb
           end
         )
      || case
           when jsonb_typeof(q.value -> 'options') = 'array'
                and jsonb_typeof(q.value -> 'options' -> 0) = 'string'
             then jsonb_build_object('options', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'id',    'o' || (opt.ord - 1)::text,
                        'label', jsonb_build_object('en', opt.label)
                      ) order by opt.ord), '[]'::jsonb)
               from jsonb_array_elements_text(q.value -> 'options')
                    with ordinality as opt(label, ord)
             ))
           else '{}'::jsonb
         end
    order by q.ord
  ), '[]'::jsonb)
  from jsonb_array_elements(f.questions) with ordinality as q(value, ord)
)
where jsonb_typeof(f.questions) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(f.questions) as q
    where jsonb_typeof(q.value -> 'title') = 'string'
       or jsonb_typeof(q.value -> 'options' -> 0) = 'string'
  );

-- ============================================================
-- get_invitation: hand the localized objects to the client
-- unresolved, and tell it which language the couple recorded.
--
-- Resolution stays client-side on purpose: a guest can switch
-- language in the portal and every string has to follow
-- immediately, with no refetch. The payload cost is a handful of
-- short strings per locale.
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
      'address',            v_address
    ),
    'guest', (
      select jsonb_build_object(
        'id',            v_guest.id,
        'first_name',    v_guest.first_name,
        'last_name',     v_guest.last_name,
        'age_years',     v_guest.age_years,
        'locale',        v_guest.locale,
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

-- ---------- set_guest_locale ----------
-- Lets the portal remember a guest's own language choice against
-- their invitation, so it survives a new device or a cleared
-- cookie. Token-scoped and security definer, same as every other
-- guest-side write: a guest may only ever set their own locale,
-- and only to a language the app actually ships.
create or replace function public.set_guest_locale(
  p_token uuid,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;
  if p_locale is not null and p_locale not in ('en', 'fr') then
    raise exception 'Unsupported language';
  end if;

  update public.guests set locale = p_locale where id = v_guest.id;

  return jsonb_build_object('status', 'saved', 'locale', p_locale);
end;
$$;

revoke all on function public.set_guest_locale(uuid, text) from public;
grant execute on function public.set_guest_locale(uuid, text) to anon, authenticated;
