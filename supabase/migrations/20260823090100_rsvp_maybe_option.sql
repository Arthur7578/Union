-- ============================================================
-- Union v1 · The "maybe" RSVP option, opt-in per wedding
--
-- 20260823090000 widened public.rsvp_status with 'maybe'. This
-- migration decides who gets to use it, and what happens when
-- they do.
--
-- Why it is opt-in rather than always on: a third button changes
-- what an RSVP *means*. Some couples need a firm headcount for a
-- caterer on a deadline and would rather chase an unsure guest
-- than bank an unsure yes; others are running a two-day event
-- where half the guest list genuinely cannot know yet. Neither
-- is wrong, so the couple decides — and until they do, the RSVP
-- behaves exactly as it did before this migration.
--
-- Where the switch lives: weddings.allow_rsvp_maybe. It is a
-- property of the wedding, not of one form — the same answer set
-- has to hold for the primary RSVP, the late reconfirmation, and
-- an organiser recording a reply over the phone, or the counts on
-- the guest list stop adding up. The guest-facing *wording* for
-- the button stays in forms.rsvp_copy with its two siblings; only
-- the behaviour is here.
--
-- What it does NOT do: turning the option off later never
-- rewrites replies already given. A 'maybe' on record stays a
-- 'maybe' until that guest answers again — silently converting
-- it to attending or declined would invent a commitment the guest
-- never made, which is the exact failure this feature exists to
-- prevent. New 'maybe' replies are simply refused while the
-- option is off.
-- ============================================================

-- ---------- the switch ----------
alter table public.weddings
  add column if not exists allow_rsvp_maybe boolean not null default false;

comment on column public.weddings.allow_rsvp_maybe is
  'Whether guests of this wedding may answer "maybe" as well as attending/declined. Off by default: a third answer changes what the headcount means, so the couple opts in. Turning it off stops new "maybe" replies but never rewrites ones already given.';

-- ---------- who may answer 'maybe' ----------
-- One place both submit paths ask, so the guest RSVP and a
-- companion RSVP can never disagree about which answers exist.
create or replace function public._rsvp_status_allowed(
  p_wedding_id uuid,
  p_status text
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_status in ('attending', 'declined') then true
    when p_status = 'maybe' then coalesce(
      (select w.allow_rsvp_maybe from public.weddings w where w.id = p_wedding_id),
      false
    )
    else false
  end;
$$;

revoke all on function public._rsvp_status_allowed(uuid, text) from public, anon, authenticated;

-- ---------- submit_rsvp ----------
-- Unchanged from 0010 except that the hardcoded two-answer check
-- becomes the wedding's own answer set.
create or replace function public.submit_rsvp(
  p_token uuid,
  p_status text,
  p_dietary_notes text default null,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest  public.guests%rowtype;
  v_status public.rsvp_status;
begin
  select * into v_guest from public.guests where invite_token = p_token;
  if v_guest.id is null then
    raise exception 'Invalid invitation token';
  end if;

  if not public._rsvp_status_allowed(v_guest.wedding_id, p_status) then
    raise exception 'Status % is not an answer this wedding accepts', p_status;
  end if;
  v_status := p_status::public.rsvp_status;

  insert into public.rsvps (guest_id, status, dietary_notes, message, responded_at)
  values (v_guest.id, v_status, p_dietary_notes, p_message, now())
  on conflict (guest_id) do update
    set status        = excluded.status,
        dietary_notes = excluded.dietary_notes,
        message       = excluded.message,
        responded_at  = now();
end;
$$;

-- ---------- submit_companion_rsvp ----------
-- Same widening. A party where the guest is sure and their
-- partner isn't is the ordinary case, not the edge case, so a
-- companion gets the same three answers the token holder does.
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

  if not public._rsvp_status_allowed(v_guest.wedding_id, p_status) then
    raise exception 'Status % is not an answer this wedding accepts', p_status;
  end if;
  v_status := p_status::public.rsvp_status;

  -- coalesce, not a bare comparison: `added_by_guest_id = v_guest.id` is NULL
  -- rather than false for a guest nobody added, so `false or NULL` came out
  -- NULL and `if not NULL` never fired — any token holder could set the RSVP
  -- and dietary notes of any other guest at the same wedding who had no
  -- adder. Carried in from 0011; fixed here rather than left in a function
  -- this migration rewrites anyway.
  select coalesce(
    exists (
      select 1
      from public.guest_relationships gr
      where gr.from_guest = v_guest.id and gr.to_guest = v_companion.id
    ) or v_companion.added_by_guest_id = v_guest.id,
    false
  )
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

-- ---------- activity_log ----------
-- A guest moving to "maybe" is the most useful RSVP event in the
-- log, not the least: it is the one that tells a co-organiser
-- there is a conversation still to have. It gets its own key
-- rather than folding into attending/declined.
alter table public.activity_log
  drop constraint if exists activity_log_action_key_valid;
alter table public.activity_log
  add constraint activity_log_action_key_valid check (
    action_key in (
      'guest_added',
      'rsvp_attending',
      'rsvp_maybe',
      'rsvp_declined',
      'collaborator_invited',
      'collaborator_joined',
      'autonomy_changed',
      'legacy'
    )
  );

create or replace function public.log_rsvp_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest_name text;
  v_action_key text;
  v_action_text text;
begin
  if TG_OP = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('attending', 'maybe', 'declined') then
    return new;
  end if;

  v_action_key := case new.status
    when 'attending' then 'rsvp_attending'
    when 'maybe'     then 'rsvp_maybe'
    else 'rsvp_declined'
  end;
  v_action_text := case new.status
    when 'attending' then 'RSVP''d yes'
    when 'maybe'     then 'RSVP''d maybe'
    else 'RSVP''d no'
  end;

  begin
    select trim(first_name || ' ' || coalesce(last_name, '')) into v_guest_name
    from public.guests where id = new.guest_id;

    insert into public.activity_log (
      wedding_id, actor_kind, actor_label, action_key, action_data, action_text
    )
    select
      g.wedding_id,
      'person',
      coalesce(v_guest_name, 'A guest'),
      v_action_key,
      '{}'::jsonb,
      v_action_text
    from public.guests g where g.id = new.guest_id;
  exception when others then
    null;
  end;

  return new;
end;
$$;

-- ---------- get_invitation ----------
-- Rebuilt from 20260820180000_guest_experience_modules.sql with
-- two additions:
--   * wedding.allow_rsvp_maybe — whether the guest portal offers
--     a third button at all. It sits on the wedding rather than
--     inside rsvp_form because a wedding may have no forms row
--     yet, and "no custom wording" must not silently mean "no
--     maybe option".
--   * rsvp_form.label_maybe — the couple's wording for that
--     button, alongside its two siblings. Blank means "use the
--     system default", exactly as for the other labels.
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
      'guest_modules',      coalesce(v_wedding.guest_modules, '{}'::jsonb),
      'allow_rsvp_maybe',   v_wedding.allow_rsvp_maybe
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
        'label_maybe',      nullif(f.rsvp_copy -> 'label_maybe', 'null'::jsonb),
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

-- ---------- grants ----------
revoke all on function public.get_invitation(uuid) from public;
revoke all on function public.submit_rsvp(uuid, text, text, text) from public;
revoke all on function public.submit_companion_rsvp(uuid, uuid, text, text) from public;
grant execute on function public.get_invitation(uuid)                          to anon, authenticated;
grant execute on function public.submit_rsvp(uuid, text, text, text)           to anon, authenticated;
grant execute on function public.submit_companion_rsvp(uuid, uuid, text, text) to anon, authenticated;
