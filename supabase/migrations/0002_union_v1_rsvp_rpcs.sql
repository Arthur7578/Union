-- ============================================================
-- Public RSVP flow: token-scoped SECURITY DEFINER functions.
-- These let anonymous guests view their invitation and submit
-- an RSVP without direct table access (no anon RLS on tables).
-- ============================================================

-- Fetch invitation details for a given guest invite token.
create or replace function public.get_invitation(p_token uuid)
returns table (
  guest_id uuid,
  guest_first_name text,
  guest_last_name text,
  party_size int,
  partner_one text,
  partner_two text,
  event_date date,
  venue_name text,
  venue_address text,
  rsvp_status public.rsvp_status,
  num_attending int,
  dietary_notes text,
  message text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    g.id,
    g.first_name,
    g.last_name,
    g.party_size,
    w.partner_one,
    w.partner_two,
    w.event_date,
    w.venue_name,
    w.venue_address,
    coalesce(r.status, 'pending'::public.rsvp_status),
    r.num_attending,
    r.dietary_notes,
    r.message
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  left join public.rsvps r on r.guest_id = g.id
  where g.invite_token = p_token;
$$;

-- Submit / update an RSVP for a given guest invite token.
create or replace function public.submit_rsvp(
  p_token uuid,
  p_status text,
  p_num_attending int default null,
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
  v_party_size int;
  v_status public.rsvp_status;
  v_num int;
begin
  -- Validate the token and resolve the guest.
  select g.id, g.party_size into v_guest_id, v_party_size
  from public.guests g
  where g.invite_token = p_token;

  if v_guest_id is null then
    raise exception 'Invalid invitation token';
  end if;

  -- Validate status.
  if p_status not in ('attending', 'declined') then
    raise exception 'Status must be attending or declined';
  end if;
  v_status := p_status::public.rsvp_status;

  -- Clamp / default the attendee count.
  if v_status = 'declined' then
    v_num := 0;
  else
    v_num := coalesce(p_num_attending, v_party_size);
    if v_num < 1 then
      v_num := 1;
    end if;
    if v_num > v_party_size then
      v_num := v_party_size;
    end if;
  end if;

  insert into public.rsvps (guest_id, status, num_attending, dietary_notes, message, responded_at)
  values (v_guest_id, v_status, v_num, p_dietary_notes, p_message, now())
  on conflict (guest_id) do update
    set status = excluded.status,
        num_attending = excluded.num_attending,
        dietary_notes = excluded.dietary_notes,
        message = excluded.message,
        responded_at = now();
end;
$$;

-- Lock down and grant execution to anonymous + authenticated roles.
revoke all on function public.get_invitation(uuid) from public;
revoke all on function public.submit_rsvp(uuid, text, int, text, text) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;
grant execute on function public.submit_rsvp(uuid, text, int, text, text) to anon, authenticated;

-- handle_new_user is a trigger function only; it must not be callable
-- directly via the REST RPC endpoint by anon/authenticated roles.
revoke all on function public.handle_new_user() from public, anon, authenticated;
