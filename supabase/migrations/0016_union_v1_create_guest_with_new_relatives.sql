-- ============================================================
-- Union v1 · Extend create_guest_with_links so the same atomic
-- call can also spin up brand-new related guests (a partner or
-- one or more children) in the same transaction.
--
-- The add-guest form now lets the couple type a partner or a
-- child's full details inline while creating the primary guest;
-- if the RPC only handled links to *existing* guests, we'd be
-- back to the pre-0014 world where a mid-flight failure could
-- leave the primary in the DB and the related rows missing.
--
-- p_new_partner:
--   nullable jsonb {first_name, last_name?, email?, phone?,
--                    age_years?, notes?}
--   Creates a guest row and mirrors a partner_of pair with the
--   primary. Ignored if the primary also received p_partner_id.
--
-- p_new_children:
--   jsonb[] of the same shape. Each element becomes a new guest
--   linked to the primary as its parent_of child.
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
  p_partner_id     uuid default null,
  p_new_partner    jsonb default null,
  p_new_children   jsonb[] default '{}'
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
  v_related_id uuid;
  v_child    jsonb;
  v_child_first text;
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

  foreach v_parent in array coalesce(p_parent_ids, '{}'::uuid[])
  loop
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_parent, v_new.id, 'parent_of')
    on conflict do nothing;
  end loop;

  if p_partner_id is not null then
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_new.id, p_partner_id, 'partner_of'),
           (p_wedding_id, p_partner_id, v_new.id, 'partner_of')
    on conflict do nothing;
  elsif p_new_partner is not null then
    -- Create the partner as its own guest row, then wire the mirror pair.
    if nullif(trim(coalesce(p_new_partner ->> 'first_name', '')), '') is null then
      raise exception 'Partner first name is required';
    end if;
    insert into public.guests (
      wedding_id, first_name, last_name, email, phone,
      age_years, notes, added_by_guest_id
    )
    values (
      p_wedding_id,
      nullif(trim(p_new_partner ->> 'first_name'), ''),
      nullif(trim(coalesce(p_new_partner ->> 'last_name', '')), ''),
      nullif(trim(coalesce(p_new_partner ->> 'email', '')), ''),
      nullif(trim(coalesce(p_new_partner ->> 'phone', '')), ''),
      nullif(p_new_partner ->> 'age_years', '')::int,
      nullif(trim(coalesce(p_new_partner ->> 'notes', '')), ''),
      v_new.id
    )
    returning id into v_related_id;
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_new.id, v_related_id, 'partner_of'),
           (p_wedding_id, v_related_id, v_new.id, 'partner_of');
  end if;

  if array_length(p_new_children, 1) is not null then
    foreach v_child in array p_new_children
    loop
      v_child_first := nullif(trim(coalesce(v_child ->> 'first_name', '')), '');
      if v_child_first is null then
        raise exception 'Every new child needs a first name';
      end if;
      insert into public.guests (
        wedding_id, first_name, last_name, email, phone,
        age_years, notes, added_by_guest_id
      )
      values (
        p_wedding_id,
        v_child_first,
        nullif(trim(coalesce(v_child ->> 'last_name', '')), ''),
        nullif(trim(coalesce(v_child ->> 'email', '')), ''),
        nullif(trim(coalesce(v_child ->> 'phone', '')), ''),
        nullif(v_child ->> 'age_years', '')::int,
        nullif(trim(coalesce(v_child ->> 'notes', '')), ''),
        v_new.id
      )
      returning id into v_related_id;
      insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
      values (p_wedding_id, v_new.id, v_related_id, 'parent_of');
    end loop;
  end if;

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
  uuid, text, text, text, text, int, text, text, text,
  uuid[], uuid[], uuid, jsonb, jsonb[]
) from public;
grant execute on function public.create_guest_with_links(
  uuid, text, text, text, text, int, text, text, text,
  uuid[], uuid[], uuid, jsonb, jsonb[]
) to authenticated;

-- Old 12-arg signature would still resolve if anyone hardcoded it,
-- but we drop it to avoid two overloads clashing on default args.
drop function if exists public.create_guest_with_links(
  uuid, text, text, text, text, int, text, text, text, uuid[], uuid[], uuid
);
