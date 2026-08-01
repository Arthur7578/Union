-- ============================================================
-- Union v1 · Let inline new-partner / new-children payloads carry
-- role and primary group, matching the add-guest form's field set.
--
-- Before: p_new_partner / p_new_children accepted first_name,
-- last_name, email, phone, age_years, notes. Any role or group
-- typed inline was silently dropped because the RPC didn't read
-- those keys. Extending the payload here so the client can stop
-- lying about what "full details" means.
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
  v_owner uuid;
  v_first text := nullif(trim(p_first_name), '');
  v_new   public.guests%rowtype;
  v_parent uuid;
  v_group  uuid;
  v_primary text := nullif(trim(coalesce(p_primary_group, '')), '');
  v_primary_group_id uuid;
  v_related_id uuid;
  v_child jsonb;
  v_child_first text;
  v_child_group text;
  v_child_group_id uuid;
  v_partner_group text;
  v_partner_group_id uuid;
begin
  if v_first is null then raise exception 'First name is required'; end if;

  select w.owner_id into v_owner from public.weddings w where w.id = p_wedding_id;
  if v_owner is null then raise exception 'Unknown wedding'; end if;
  if v_owner <> auth.uid() then raise exception 'Not allowed to add guests to this wedding'; end if;

  if p_partner_id is not null then
    perform 1 from public.guests where id = p_partner_id and wedding_id = p_wedding_id;
    if not found then raise exception 'Partner guest is not in this wedding'; end if;
  end if;
  if array_length(p_parent_ids, 1) is not null then
    perform 1 from public.guests
      where wedding_id = p_wedding_id and id = any(p_parent_ids)
      having count(*) = array_length(p_parent_ids, 1);
    if not found then raise exception 'One or more parents are not in this wedding'; end if;
  end if;
  if array_length(p_group_ids, 1) is not null then
    perform 1 from public.guest_groups
      where wedding_id = p_wedding_id and id = any(p_group_ids)
      having count(*) = array_length(p_group_ids, 1);
    if not found then raise exception 'One or more groups are not in this wedding'; end if;
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
    if nullif(trim(coalesce(p_new_partner ->> 'first_name', '')), '') is null then
      raise exception 'Partner first name is required';
    end if;
    v_partner_group := nullif(trim(coalesce(p_new_partner ->> 'guest_group', '')), '');
    insert into public.guests (
      wedding_id, first_name, last_name, email, phone,
      age_years, role, notes, guest_group, added_by_guest_id
    )
    values (
      p_wedding_id,
      nullif(trim(p_new_partner ->> 'first_name'), ''),
      nullif(trim(coalesce(p_new_partner ->> 'last_name', '')), ''),
      nullif(trim(coalesce(p_new_partner ->> 'email', '')), ''),
      nullif(trim(coalesce(p_new_partner ->> 'phone', '')), ''),
      nullif(p_new_partner ->> 'age_years', '')::int,
      nullif(trim(coalesce(p_new_partner ->> 'role', '')), ''),
      nullif(trim(coalesce(p_new_partner ->> 'notes', '')), ''),
      v_partner_group,
      v_new.id
    )
    returning id into v_related_id;
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_new.id, v_related_id, 'partner_of'),
           (p_wedding_id, v_related_id, v_new.id, 'partner_of');
    if v_partner_group is not null then
      select id into v_partner_group_id
        from public.guest_groups
       where wedding_id = p_wedding_id and name = v_partner_group;
      if v_partner_group_id is null then
        insert into public.guest_groups (wedding_id, name)
        values (p_wedding_id, v_partner_group)
        returning id into v_partner_group_id;
      end if;
      insert into public.guest_group_members (guest_id, group_id)
      values (v_related_id, v_partner_group_id)
      on conflict do nothing;
    end if;
  end if;

  if array_length(p_new_children, 1) is not null then
    foreach v_child in array p_new_children
    loop
      v_child_first := nullif(trim(coalesce(v_child ->> 'first_name', '')), '');
      if v_child_first is null then
        raise exception 'Every new child needs a first name';
      end if;
      v_child_group := nullif(trim(coalesce(v_child ->> 'guest_group', '')), '');
      insert into public.guests (
        wedding_id, first_name, last_name, email, phone,
        age_years, role, notes, guest_group, added_by_guest_id
      )
      values (
        p_wedding_id,
        v_child_first,
        nullif(trim(coalesce(v_child ->> 'last_name', '')), ''),
        nullif(trim(coalesce(v_child ->> 'email', '')), ''),
        nullif(trim(coalesce(v_child ->> 'phone', '')), ''),
        nullif(v_child ->> 'age_years', '')::int,
        nullif(trim(coalesce(v_child ->> 'role', '')), ''),
        nullif(trim(coalesce(v_child ->> 'notes', '')), ''),
        v_child_group,
        v_new.id
      )
      returning id into v_related_id;
      insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
      values (p_wedding_id, v_new.id, v_related_id, 'parent_of');
      if v_child_group is not null then
        select id into v_child_group_id
          from public.guest_groups
         where wedding_id = p_wedding_id and name = v_child_group;
        if v_child_group_id is null then
          insert into public.guest_groups (wedding_id, name)
          values (p_wedding_id, v_child_group)
          returning id into v_child_group_id;
        end if;
        insert into public.guest_group_members (guest_id, group_id)
        values (v_related_id, v_child_group_id)
        on conflict do nothing;
      end if;
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
