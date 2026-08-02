-- ============================================================
-- Union v1 · RSVP form as a guarded "system block"
--
-- Two problems with the plain forms.questions model from 0023:
--
--   1. The RSVP-kind form was inert — the real guest RSVP flow
--      (GuestPortal + submit_rsvp/submit_companion_rsvp) is fully
--      hardcoded and never reads forms.questions at all. There was
--      no way for a couple to reword their RSVP ask without editing
--      code.
--   2. "One rsvp-kind form per wedding, ever" made it impossible to
--      schedule a second, later RSVP touchpoint (a pre-wedding
--      reconfirmation) without inventing a whole new form kind.
--
-- This migration:
--   * adds `purpose` so a wedding can have both a 'primary' RSVP
--     form and a 'reconfirmation' one, each independently scheduled
--     via the existing opens_at/closes_at — no new scheduling
--     concept needed.
--   * adds `rsvp_copy`, a *fixed-shape* jsonb bag for the RSVP
--     block's guest-facing wording (title/subtitle/button labels).
--     It is deliberately not a free-form list: each key is a named
--     slot bound to a real rsvp_status value, so rewording can never
--     silently invert which button means "coming" vs "not coming" —
--     there is no shared list to reorder or swap in the first place.
--     Only 'primary' forms use label_attending/label_declined; the
--     buttons a reconfirmation form shows are the same buttons,
--     wired to the same primary labels (or system defaults).
-- ============================================================

alter table public.forms
  add column if not exists purpose text not null default 'primary'
    check (purpose in ('primary', 'reconfirmation')),
  add column if not exists rsvp_copy jsonb not null default '{}'::jsonb;

-- Only 'rsvp' kind forms use purpose; keep it meaningless-but-tidy
-- for 'custom' forms rather than allowing drift.
alter table public.forms
  add constraint forms_purpose_primary_for_custom
    check (kind = 'rsvp' or purpose = 'primary');

-- Replace "one rsvp form per wedding, ever" with "one rsvp form per
-- (wedding, purpose)" — this is what actually allows a second,
-- later RSVP touchpoint (reconfirmation) to exist alongside the
-- primary one.
drop index if exists public.forms_one_rsvp_per_wedding;
create unique index if not exists forms_one_rsvp_per_wedding_purpose
  on public.forms (wedding_id, purpose)
  where (kind = 'rsvp');

-- ---------- get_invitation: surface the RSVP block's wording ----------
-- Guests never see forms.title (organiser-only) — only rsvp_copy,
-- and only the keys relevant to each form. Missing/blank keys mean
-- "use the system default", handled client-side in GuestPortal.
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
    )
  );

  return v_result;
end;
$$;
