-- ============================================================
-- Union v1 · Owner-side guest merge for the co-parent dedup case.
--
-- Adds a shared internal helper _merge_guests and rewrites the
-- previous rsvp_merge_into (0010) to call it, so the actual
-- merge logic lives in one place. Adds a new owner_merge_guests
-- RPC that lets the wedder resolve duplicates from the couple's
-- side of the app (auth-gated on the wedding's owner_id).
-- ============================================================

-- Private helper: does the actual merge work. Both public wrappers
-- (rsvp_merge_into, owner_merge_guests) call it after their own
-- authorisation check. Not granted to anon or authenticated — only
-- callable from other SECURITY DEFINER functions in this schema.
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
    profile_id        = coalesce(profile_id,        v_source.profile_id),
    added_by_guest_id = coalesce(added_by_guest_id, v_source.added_by_guest_id),
    role              = coalesce(role,              v_source.role),
    notes             = coalesce(notes,             v_source.notes),
    guest_group       = coalesce(guest_group,       v_source.guest_group),
    room_block_id     = coalesce(room_block_id,     v_source.room_block_id),
    seating_table_id  = coalesce(seating_table_id,  v_source.seating_table_id),
    kind              = case
                          when v_target.kind = 'adult' or v_source.kind = 'adult'
                          then 'adult'::public.guest_kind
                          else v_target.kind
                        end
  where id = v_target.id;

  update public.rsvps set guest_id = v_target.id
  where guest_id = v_source.id
    and not exists (select 1 from public.rsvps where guest_id = v_target.id);

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

revoke all on function public._merge_guests(uuid, uuid) from public, anon, authenticated;

-- rsvp_merge_into: unchanged interface, but now just does the
-- token check + delegates.
create or replace function public.rsvp_merge_into(
  p_token uuid,
  p_target_guest_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_target    public.guests%rowtype;
  v_merged    uuid;
begin
  select id into v_source_id from public.guests where invite_token = p_token;
  if v_source_id is null then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_target from public.guests where id = p_target_guest_id;
  if v_target.id is null then
    raise exception 'Unknown merge target';
  end if;

  v_merged := public._merge_guests(v_source_id, p_target_guest_id);
  return jsonb_build_object('status', 'merged', 'guest_id', v_merged);
end;
$$;

-- owner_merge_guests: wedder-side merge used by the duplicates
-- review screen. Verifies the caller owns the guests' wedding.
create or replace function public.owner_merge_guests(
  p_source_guest_id uuid,
  p_target_guest_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.guests%rowtype;
  v_owner  uuid;
  v_merged uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_source from public.guests where id = p_source_guest_id;
  if v_source.id is null then
    raise exception 'Unknown source guest';
  end if;

  select owner_id into v_owner from public.weddings where id = v_source.wedding_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not authorised';
  end if;

  v_merged := public._merge_guests(p_source_guest_id, p_target_guest_id);
  return jsonb_build_object('status', 'merged', 'guest_id', v_merged);
end;
$$;

revoke all on function public.owner_merge_guests(uuid, uuid) from public, anon;
grant execute on function public.owner_merge_guests(uuid, uuid) to authenticated;
