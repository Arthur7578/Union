-- ============================================================
-- Union v1 · Custom form responses
--
-- 0023 introduced 'custom' forms as organiser-side scaffolding only —
-- their questions were never shown to guests, and there was nowhere
-- to store an answer even if they had been. This migration closes
-- that gap for the free-form question types (single/multi/short/
-- comment): a couple can now publish a custom form and guests can
-- actually answer it.
--
-- The RSVP block itself is untouched — it keeps writing straight to
-- guests/rsvps via submit_rsvp/submit_companion_rsvp, not through
-- this table. form_responses is only for 'custom' forms.
-- ============================================================

create table if not exists public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (form_id, guest_id)
);
alter table public.form_responses enable row level security;
create index if not exists form_responses_form_id_idx on public.form_responses (form_id);
create index if not exists form_responses_guest_id_idx on public.form_responses (guest_id);

-- ---------- RLS ----------
-- Guests never query this table directly (no auth session) — all
-- reads/writes go through get_invitation / submit_form_response,
-- both security definer. Only the wedding owner reads it directly,
-- same owner-scoped pattern as every other table here.
drop policy if exists "Form responses selectable by wedding owner" on public.form_responses;
create policy "Form responses selectable by wedding owner"
  on public.form_responses for select
  using (exists (
    select 1 from public.forms f
    join public.weddings w on w.id = f.wedding_id
    where f.id = form_responses.form_id and w.owner_id = auth.uid()
  ));

-- ---------- submit_form_response ----------
-- Upserts one guest's answers to one custom form. Rejects anything
-- that isn't a published, currently-open 'custom' form for the
-- token's own wedding — the same window rules formStatus() already
-- enforces client-side, re-checked here since the client can't be
-- trusted.
create or replace function public.submit_form_response(
  p_token uuid,
  p_form_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
  v_form  public.forms%rowtype;
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

  insert into public.form_responses (form_id, guest_id, answers)
  values (p_form_id, v_guest.id, coalesce(p_answers, '{}'::jsonb))
  on conflict (form_id, guest_id)
  do update set answers = excluded.answers, submitted_at = now();

  return jsonb_build_object('status', 'saved');
end;
$$;

revoke all on function public.submit_form_response(uuid, uuid, jsonb) from public;
grant execute on function public.submit_form_response(uuid, uuid, jsonb) to anon, authenticated;

-- ---------- get_invitation: surface published custom forms ----------
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

  v_result := jsonb_build_object(
    'wedding', jsonb_build_object(
      'partner_one', v_wedding.partner_one,
      'partner_two', v_wedding.partner_two,
      'event_date',  v_wedding.event_date,
      'venue_name',  v_wedding.venue_name,
      'venue_address', v_wedding.venue_address
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
