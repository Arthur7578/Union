-- ============================================================
-- Union v1 · create_guest_with_links
--
-- The new-guest form used to run a sequence of client-side calls:
-- insert guest, insert each parent_of edge, insert partner_of, insert
-- group memberships. A failure halfway through left a half-created
-- guest floating with no links or with only some of them — the form
-- surfaced the error but there was no rollback.
--
-- This RPC does the whole thing in one server-side transaction, so
-- any failure (auth, cross-wedding id, constraint violation, network
-- blip) leaves the database exactly as it was.
--
-- Ownership is enforced explicitly at the top instead of by RLS,
-- since we run SECURITY DEFINER so the group + relationship inserts
-- bypass the individual table policies.
-- ============================================================

create or replace function public.create_guest_with_links(
  p_wedding_id     uuid,
  p_first_name     text,
  p_last_name      text default null,
  p_email          text default null,
  p_phone          text default null,
  p_age_years      int  default null,
  p_role           text default null,
  p_notes          text default null,
  p_primary_group  text default null,
  p_group_ids      uuid[] default '{}',
  p_parent_ids     uuid[] default '{}',
  p_partner_id     uuid default null
)
returns public.guests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_first    text := nullif(trim(p_first_name), '');
  v_new      public.guests%rowtype;
  v_parent   uuid;
  v_group    uuid;
  v_primary  text := nullif(trim(coalesce(p_primary_group, '')), '');
  v_primary_group_id uuid;
begin
  if v_first is null then
    raise exception 'First name is required';
  end if;

  select w.owner_id into v_owner_id
    from public.weddings w where w.id = p_wedding_id;
  if v_owner_id is null then
    raise exception 'Unknown wedding';
  end if;
  if v_owner_id <> auth.uid() then
    raise exception 'Not allowed to add guests to this wedding';
  end if;

  -- Every id we're about to reference must belong to this wedding,
  -- otherwise the caller could stitch guests across weddings.
  if p_partner_id is not null then
    perform 1 from public.guests
      where id = p_partner_id and wedding_id = p_wedding_id;
    if not found then
      raise exception 'Partner guest is not in this wedding';
    end if;
  end if;

  if array_length(p_parent_ids, 1) is not null then
    perform 1 from public.guests
      where wedding_id = p_wedding_id
        and id = any(p_parent_ids)
      having count(*) = array_length(p_parent_ids, 1);
    if not found then
      raise exception 'One or more parents are not in this wedding';
    end if;
  end if;

  if array_length(p_group_ids, 1) is not null then
    perform 1 from public.guest_groups
      where wedding_id = p_wedding_id
        and id = any(p_group_ids)
      having count(*) = array_length(p_group_ids, 1);
    if not found then
      raise exception 'One or more groups are not in this wedding';
    end if;
  end if;

  insert into public.guests (
    wedding_id, first_name, last_name, email, phone,
    age_years, role, notes, guest_group
  )
  values (
    p_wedding_id, v_first,
    nullif(trim(coalesce(p_last_name, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    p_age_years,
    nullif(trim(coalesce(p_role, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_primary
  )
  returning * into v_new;

  -- parent_of edges: parent → new child.
  foreach v_parent in array coalesce(p_parent_ids, '{}'::uuid[])
  loop
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_parent, v_new.id, 'parent_of')
    on conflict do nothing;
  end loop;

  -- partner_of edges: two rows so lookups are symmetric.
  if p_partner_id is not null then
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_new.id, p_partner_id, 'partner_of'),
           (p_wedding_id, p_partner_id, v_new.id, 'partner_of')
    on conflict do nothing;
  end if;

  -- Primary text group: mirror it into the join table so the Groups
  -- screen sees the guest under that label. Create the group row if
  -- it doesn't exist yet.
  if v_primary is not null then
    select id into v_primary_group_id
      from public.guest_groups
     where wedding_id = p_wedding_id and name = v_primary;
    if v_primary_group_id is null then
      insert into public.guest_groups (wedding_id, name)
      values (p_wedding_id, v_primary)
      returning id into v_primary_group_id;
    end if;
    insert into public.guest_group_members (guest_id, group_id)
    values (v_new.id, v_primary_group_id)
    on conflict do nothing;
  end if;

  -- Extra memberships from the multi-picker.
  foreach v_group in array coalesce(p_group_ids, '{}'::uuid[])
  loop
    insert into public.guest_group_members (guest_id, group_id)
    values (v_new.id, v_group)
    on conflict do nothing;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.create_guest_with_links(
  uuid, text, text, text, text, int, text, text, text, uuid[], uuid[], uuid
) from public;
grant execute on function public.create_guest_with_links(
  uuid, text, text, text, text, int, text, text, text, uuid[], uuid[], uuid
) to authenticated;
