-- ============================================================
-- Union v1 · Merging two guests who each have a partner
--
-- A partner is stored as a mirrored pair of partner_of rows (A -> B and
-- B -> A), and 20260820220315 allows a guest only one outgoing partner_of.
-- _merge_guests moves the source's outgoing relationships to the target,
-- so when the target already had a partner and the source had a different
-- one, the target ended up with two and the merge failed on
-- guest_relationships_one_partner_per_guest. Merging three duplicates
-- could stop half way: each fold is its own call, so the folds before the
-- failing one had already committed.
--
-- The target's partner now wins, as the target's own values do for every
-- other field: when the target has a partner, the source's partner pair
-- (both rows) is dropped before relationships are moved. The source's
-- partner stays on the guest list, without a partner. When the target has
-- none, the source's partner moves over as before.
--
-- Otherwise the same function as in 0014.
-- ============================================================

create or replace function public._merge_guests(
  p_source_id uuid,
  p_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source  public.guests%rowtype;
  v_target  public.guests%rowtype;
begin
  select * into v_source from public.guests where id = p_source_id;
  select * into v_target from public.guests where id = p_target_id;

  if v_source.id is null or v_target.id is null then
    raise exception 'Unknown source or target guest';
  end if;
  if v_source.wedding_id <> v_target.wedding_id then
    raise exception 'Guests belong to different weddings';
  end if;
  if v_source.id = v_target.id then
    raise exception 'Cannot merge a guest into itself';
  end if;

  update public.guests set
    email             = coalesce(email,             v_source.email),
    phone             = coalesce(phone,             v_source.phone),
    last_name         = coalesce(last_name,         v_source.last_name),
    age_years         = coalesce(age_years,         v_source.age_years),
    profile_id        = coalesce(profile_id,        v_source.profile_id),
    added_by_guest_id = coalesce(added_by_guest_id, v_source.added_by_guest_id),
    role              = coalesce(role,              v_source.role),
    notes             = coalesce(notes,             v_source.notes),
    guest_group       = coalesce(guest_group,       v_source.guest_group),
    room_block_id     = coalesce(room_block_id,     v_source.room_block_id),
    seating_table_id  = coalesce(seating_table_id,  v_source.seating_table_id)
  where id = v_target.id;

  update public.rsvps set guest_id = v_target.id
  where guest_id = v_source.id
    and not exists (select 1 from public.rsvps where guest_id = v_target.id);

  -- One partner per guest: the target's partner wins (see header).
  if exists (
    select 1 from public.guest_relationships
     where from_guest = v_target.id and kind = 'partner_of'
  ) then
    delete from public.guest_relationships gr
     where gr.kind = 'partner_of'
       and (   (gr.from_guest = v_source.id and gr.to_guest   <> v_target.id)
            or (gr.to_guest   = v_source.id and gr.from_guest <> v_target.id));
  end if;

  update public.guest_relationships gr
     set from_guest = v_target.id
   where gr.from_guest = v_source.id
     and gr.to_guest <> v_target.id
     and not exists (
       select 1 from public.guest_relationships x
        where x.from_guest = v_target.id
          and x.to_guest   = gr.to_guest
          and x.kind       = gr.kind
     );

  update public.guest_relationships gr
     set to_guest = v_target.id
   where gr.to_guest = v_source.id
     and gr.from_guest <> v_target.id
     and not exists (
       select 1 from public.guest_relationships x
        where x.from_guest = gr.from_guest
          and x.to_guest   = v_target.id
          and x.kind       = gr.kind
     );

  update public.guests set added_by_guest_id = v_target.id
   where added_by_guest_id = v_source.id;

  update public.guests set invite_token = gen_random_uuid() where id = v_source.id;
  update public.guests set invite_token = v_source.invite_token where id = v_target.id;

  delete from public.guests where id = v_source.id;

  return v_target.id;
end;
$$;
