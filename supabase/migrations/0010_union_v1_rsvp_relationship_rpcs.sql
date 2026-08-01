-- ============================================================
-- Union v1 · Anonymous RSVP flow, updated for the relationship model.
--
-- get_invitation and submit_rsvp are rewritten to drop the
-- party_size / num_attending counter. get_invitation now returns
-- one JSONB payload with:
--   * wedding meta
--   * the guest the token belongs to (with their RSVP row, if any)
--   * pre-linked companions the guest can register/edit
--   * derived permissions for adding new companions
--   * self-merge candidates (light guests with a matching name
--     already added by someone else in the same wedding)
--
-- Three new RPCs are stubbed with clear signatures so the client
-- can start wiring against them; they raise NOTICE + return a
-- structured "not_implemented" payload until the second pass
-- fills them in.
-- ============================================================

-- Old table-returning function must be dropped before we change
-- its return type / signature.
drop function if exists public.get_invitation(uuid);
drop function if exists public.submit_rsvp(uuid, text, int, text, text);

-- ---------- get_invitation ----------
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

  -- Permission derivation: wedding-level toggle, overridden by per-guest flag when set.
  v_can_partner := coalesce(v_guest.can_add_partner, v_wedding.allow_guests_add_partner);
  v_can_kids    := coalesce(v_guest.can_add_kids,    v_wedding.allow_guests_add_kids);

  select count(*) into v_kids_used
  from public.guest_relationships gr
  join public.guests g on g.id = gr.to_guest
  where gr.from_guest = v_guest.id
    and gr.kind = 'parent_of'
    and g.kind = 'child';

  v_kids_cap := v_wedding.max_kids_per_guest;

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
        'kind',          v_guest.kind,
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
        'kind',          c.kind,
        'relationship',  gr.kind,
        'rsvp_status',   coalesce(cr.status, 'pending'::public.rsvp_status),
        'dietary_notes', cr.dietary_notes
      ) order by c.kind, c.first_name)
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
    -- Light guests with a matching first name in the same wedding, added by
    -- someone other than this guest — used to prompt "looks like Alice
    -- already added you, is this you?" on the RSVP screen.
    'self_merge_candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                    m.id,
        'first_name',            m.first_name,
        'last_name',             m.last_name,
        'kind',                  m.kind,
        'added_by_first_name',   ab.first_name
      ))
      from public.guests m
      left join public.guests ab on ab.id = m.added_by_guest_id
      where m.wedding_id = v_guest.wedding_id
        and m.id <> v_guest.id
        and lower(m.first_name) = lower(v_guest.first_name)
        and (
          v_guest.last_name is null
          or m.last_name is null
          or lower(m.last_name) = lower(v_guest.last_name)
        )
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

-- ---------- submit_rsvp ----------
-- Records a reply for the guest the token belongs to. Companion
-- replies go through submit_companion_rsvp so each attendee has
-- their own row (which is what feeds seating, stays, and dietary).
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
  v_guest_id uuid;
  v_status   public.rsvp_status;
begin
  select id into v_guest_id from public.guests where invite_token = p_token;
  if v_guest_id is null then
    raise exception 'Invalid invitation token';
  end if;

  if p_status not in ('attending', 'declined') then
    raise exception 'Status must be attending or declined';
  end if;
  v_status := p_status::public.rsvp_status;

  insert into public.rsvps (guest_id, status, dietary_notes, message, responded_at)
  values (v_guest_id, v_status, p_dietary_notes, p_message, now())
  on conflict (guest_id) do update
    set status        = excluded.status,
        dietary_notes = excluded.dietary_notes,
        message       = excluded.message,
        responded_at  = now();
end;
$$;

-- ---------- submit_companion_rsvp (stub) ----------
-- Will let the token holder record an RSVP for a companion they
-- can manage (partner they're linked to, or a child they added).
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
begin
  raise notice 'submit_companion_rsvp is not implemented yet';
  return jsonb_build_object('status', 'not_implemented');
end;
$$;

-- ---------- rsvp_register_companion (stub) ----------
-- Will create a linked light guest (partner or child) for the
-- token holder, after checking permissions and running the
-- dedup check against existing rows in the same wedding.
-- p_resolve: 'auto' (returns candidates when ambiguous) |
--            'force_create' (creates anyway).
create or replace function public.rsvp_register_companion(
  p_token uuid,
  p_kind text,
  p_first_name text,
  p_last_name text default null,
  p_resolve text default 'auto'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise notice 'rsvp_register_companion is not implemented yet';
  return jsonb_build_object('status', 'not_implemented');
end;
$$;

-- ---------- rsvp_merge_into (stub) ----------
-- Will merge the token's guest row into an existing target guest
-- (used both for "is this you?" self-merge on RSVP and for the
-- co-parent kid dedup once we build the review queue). Preserves
-- relationships on the target and reassigns the invite_token so
-- subsequent calls with the same token continue to work.
create or replace function public.rsvp_merge_into(
  p_token uuid,
  p_target_guest_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise notice 'rsvp_merge_into is not implemented yet';
  return jsonb_build_object('status', 'not_implemented');
end;
$$;

-- ---------- grants ----------
revoke all on function public.get_invitation(uuid) from public;
revoke all on function public.submit_rsvp(uuid, text, text, text) from public;
revoke all on function public.submit_companion_rsvp(uuid, uuid, text, text) from public;
revoke all on function public.rsvp_register_companion(uuid, text, text, text, text) from public;
revoke all on function public.rsvp_merge_into(uuid, uuid) from public;

grant execute on function public.get_invitation(uuid)                             to anon, authenticated;
grant execute on function public.submit_rsvp(uuid, text, text, text)              to anon, authenticated;
grant execute on function public.submit_companion_rsvp(uuid, uuid, text, text)    to anon, authenticated;
grant execute on function public.rsvp_register_companion(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.rsvp_merge_into(uuid, uuid)                      to anon, authenticated;
