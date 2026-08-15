-- ============================================================
-- Union v1 · Real collaborator access + localized activity
--
-- A collaborator row is not useful unless that person can resolve and
-- operate on the shared wedding. Centralize membership checks in a private,
-- non-exposed helper, extend planning-data RLS to team members, and replace
-- owner-only checks in organiser RPCs below.
--
-- Activity rows keep an English fallback for backwards compatibility, but
-- now also carry a stable action key and structured data so each client can
-- render the event in its active locale.
-- ============================================================

create schema if not exists union_private;
revoke all on schema union_private from public, anon;
grant usage on schema union_private to authenticated;

create or replace function union_private.can_access_wedding(p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1
      from public.weddings w
      where w.id = p_wedding_id
        and w.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.wedding_collaborators c
      where c.wedding_id = p_wedding_id
        and c.status in ('pending', 'active')
        and (
          c.user_id = auth.uid()
          or lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );
$$;

revoke all on function union_private.can_access_wedding(uuid) from public, anon, authenticated;
grant execute on function union_private.can_access_wedding(uuid) to authenticated;

create index if not exists wedding_collaborators_active_user_idx
  on public.wedding_collaborators (user_id, wedding_id)
  where status = 'active';

-- The id and owner define a wedding's security boundary and are immutable.
create or replace function public.guard_wedding_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
    raise exception 'Wedding identity cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists weddings_guard_identity on public.weddings;
create trigger weddings_guard_identity
  before update of id, owner_id on public.weddings
  for each row execute function public.guard_wedding_identity();

revoke all on function public.guard_wedding_identity() from public, anon, authenticated;

-- ---------- wedding ----------
drop policy if exists "Weddings selectable by team members" on public.weddings;
create policy "Weddings selectable by team members"
  on public.weddings for select
  to authenticated
  using ((select union_private.can_access_wedding(id)));

drop policy if exists "Weddings updatable by team members" on public.weddings;
create policy "Weddings updatable by team members"
  on public.weddings for update
  to authenticated
  using ((select union_private.can_access_wedding(id)))
  with check ((select union_private.can_access_wedding(id)));

-- ---------- guests ----------
drop policy if exists "Guests selectable by team members" on public.guests;
create policy "Guests selectable by team members"
  on public.guests for select to authenticated
  using ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Guests insertable by team members" on public.guests;
create policy "Guests insertable by team members"
  on public.guests for insert to authenticated
  with check ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Guests updatable by team members" on public.guests;
create policy "Guests updatable by team members"
  on public.guests for update to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Guests deletable by team members" on public.guests;
create policy "Guests deletable by team members"
  on public.guests for delete to authenticated
  using ((select union_private.can_access_wedding(wedding_id)));

-- ---------- RSVPs ----------
drop policy if exists "Rsvps selectable by team members" on public.rsvps;
create policy "Rsvps selectable by team members"
  on public.rsvps for select to authenticated
  using (exists (
    select 1 from public.guests g
    where g.id = rsvps.guest_id
      and (select union_private.can_access_wedding(g.wedding_id))
  ));

drop policy if exists "Rsvps insertable by team members" on public.rsvps;
create policy "Rsvps insertable by team members"
  on public.rsvps for insert to authenticated
  with check (exists (
    select 1 from public.guests g
    where g.id = rsvps.guest_id
      and (select union_private.can_access_wedding(g.wedding_id))
  ));

drop policy if exists "Rsvps updatable by team members" on public.rsvps;
create policy "Rsvps updatable by team members"
  on public.rsvps for update to authenticated
  using (exists (
    select 1 from public.guests g
    where g.id = rsvps.guest_id
      and (select union_private.can_access_wedding(g.wedding_id))
  ))
  with check (exists (
    select 1 from public.guests g
    where g.id = rsvps.guest_id
      and (select union_private.can_access_wedding(g.wedding_id))
  ));

drop policy if exists "Rsvps deletable by team members" on public.rsvps;
create policy "Rsvps deletable by team members"
  on public.rsvps for delete to authenticated
  using (exists (
    select 1 from public.guests g
    where g.id = rsvps.guest_id
      and (select union_private.can_access_wedding(g.wedding_id))
  ));

-- ---------- direct wedding_id tables ----------
drop policy if exists "Guest groups manageable by team members" on public.guest_groups;
create policy "Guest groups manageable by team members"
  on public.guest_groups for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Room blocks manageable by team members" on public.room_blocks;
create policy "Room blocks manageable by team members"
  on public.room_blocks for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Seating tables manageable by team members" on public.seating_tables;
create policy "Seating tables manageable by team members"
  on public.seating_tables for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Guest relationships manageable by team members" on public.guest_relationships;
create policy "Guest relationships manageable by team members"
  on public.guest_relationships for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Hidden clusters manageable by team members" on public.hidden_merge_clusters;
create policy "Hidden clusters manageable by team members"
  on public.hidden_merge_clusters for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

drop policy if exists "Forms manageable by team members" on public.forms;
create policy "Forms manageable by team members"
  on public.forms for all to authenticated
  using ((select union_private.can_access_wedding(wedding_id)))
  with check ((select union_private.can_access_wedding(wedding_id)));

-- A form response is written by a guest-facing RPC and is immutable in the
-- organiser UI; planners need to read it, not rewrite the guest's answer.
drop policy if exists "Form responses selectable by team members" on public.form_responses;
create policy "Form responses selectable by team members"
  on public.form_responses for select to authenticated
  using (exists (
    select 1 from public.forms f
    where f.id = form_responses.form_id
      and (select union_private.can_access_wedding(f.wedding_id))
  ));

-- Membership rows derive their wedding through the guest.
drop policy if exists "Guest group memberships manageable by team members" on public.guest_group_members;
create policy "Guest group memberships manageable by team members"
  on public.guest_group_members for all to authenticated
  using (exists (
    select 1 from public.guests g
    where g.id = guest_group_members.guest_id
      and (select union_private.can_access_wedding(g.wedding_id))
  ))
  with check (exists (
    select 1 from public.guests g
    where g.id = guest_group_members.guest_id
      and (select union_private.can_access_wedding(g.wedding_id))
  ));

drop policy if exists "Activity selectable by team members" on public.activity_log;
create policy "Activity selectable by team members"
  on public.activity_log for select to authenticated
  using ((select union_private.can_access_wedding(wedding_id)));

-- Explicit Data API privileges: new projects can opt out of exposing newly
-- created public tables by default, independently of RLS.
grant select on public.activity_log to authenticated;
grant select, insert, delete on public.wedding_collaborators to authenticated;

-- The collaborator list remains the narrow way to expose teammate names.
create or replace function public.list_collaborators(p_wedding_id uuid)
returns table (
  id uuid,
  wedding_id uuid,
  email text,
  user_id uuid,
  status text,
  invited_at timestamptz,
  joined_at timestamptz,
  profile_full_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.wedding_id,
    c.email,
    c.user_id,
    c.status,
    c.invited_at,
    c.joined_at,
    p.full_name
  from public.wedding_collaborators c
  left join public.profiles p on p.id = c.user_id
  where c.wedding_id = p_wedding_id
    and union_private.can_access_wedding(p_wedding_id)
  order by c.invited_at asc;
$$;

revoke all on function public.list_collaborators(uuid) from public, anon;
grant execute on function public.list_collaborators(uuid) to authenticated;

-- ---------- structured, localizable activity ----------
alter table public.activity_log
  add column if not exists action_key text,
  add column if not exists action_data jsonb;

update public.activity_log
set
  action_key = 'guest_added',
  action_data = jsonb_build_object(
    'guest_name', substring(action_text from '^added (.*) as a guest$')
  )
where action_key is null and action_text ~ '^added .* as a guest$';

update public.activity_log
set action_key = 'rsvp_attending', action_data = '{}'::jsonb
where action_key is null and action_text = 'RSVP''d yes';

update public.activity_log
set action_key = 'rsvp_declined', action_data = '{}'::jsonb
where action_key is null and action_text = 'RSVP''d no';

update public.activity_log
set
  action_key = 'collaborator_invited',
  action_data = jsonb_build_object(
    'email', substring(action_text from '^invited (.*) to plan together$')
  )
where action_key is null and action_text ~ '^invited .* to plan together$';

update public.activity_log
set action_key = 'collaborator_joined', action_data = '{}'::jsonb
where action_key is null and action_text = 'joined to plan together';

update public.activity_log
set
  action_key = 'autonomy_changed',
  action_data = jsonb_build_object(
    'level', substring(action_text from '"([^"]+)"$')
  )
where action_key is null
  and action_text ~ '^set how much Union does on its own to ".*"$';

update public.activity_log
set
  action_key = 'legacy',
  action_data = jsonb_build_object('text', action_text)
where action_key is null;

alter table public.activity_log
  alter column action_key set default 'legacy',
  alter column action_key set not null,
  alter column action_data set default '{}'::jsonb,
  alter column action_data set not null;

alter table public.activity_log
  drop constraint if exists activity_log_action_key_valid;
alter table public.activity_log
  add constraint activity_log_action_key_valid check (
    action_key in (
      'guest_added',
      'rsvp_attending',
      'rsvp_declined',
      'collaborator_invited',
      'collaborator_joined',
      'autonomy_changed',
      'legacy'
    )
  );

create or replace function public.log_guest_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest_name text := trim(new.first_name || ' ' || coalesce(new.last_name, ''));
begin
  begin
    insert into public.activity_log (
      wedding_id, actor_kind, actor_label, action_key, action_data, action_text
    ) values (
      new.wedding_id,
      'person',
      public.current_actor_label(new.wedding_id),
      'guest_added',
      jsonb_build_object('guest_name', v_guest_name),
      'added ' || v_guest_name || ' as a guest'
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

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
  if new.status not in ('attending', 'declined') then
    return new;
  end if;

  v_action_key := case new.status
    when 'attending' then 'rsvp_attending'
    else 'rsvp_declined'
  end;
  v_action_text := case new.status
    when 'attending' then 'RSVP''d yes'
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

create or replace function public.log_collaborator_invited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.activity_log (
      wedding_id, actor_kind, actor_label, action_key, action_data, action_text
    ) values (
      new.wedding_id,
      'person',
      public.current_actor_label(new.wedding_id),
      'collaborator_invited',
      jsonb_build_object('email', new.email),
      'invited ' || new.email || ' to plan together'
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function public.log_collaborator_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status = 'pending' then
    begin
      insert into public.activity_log (
        wedding_id, actor_kind, actor_label, action_key, action_data, action_text
      ) values (
        new.wedding_id,
        'person',
        coalesce((select full_name from public.profiles where id = new.user_id), new.email),
        'collaborator_joined',
        '{}'::jsonb,
        'joined to plan together'
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

create or replace function public.log_autonomy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.autonomy is distinct from old.autonomy then
    begin
      insert into public.activity_log (
        wedding_id, actor_kind, actor_label, action_key, action_data, action_text
      ) values (
        new.id,
        'person',
        public.current_actor_label(new.id),
        'autonomy_changed',
        jsonb_build_object('level', new.autonomy),
        'set how much Union does on its own to "' || new.autonomy || '"'
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;
-- Team-authorized replacement for public.create_guest_with_links.
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
  v_gid  uuid;
begin
  if v_first is null then raise exception 'First name is required'; end if;
  if not union_private.can_access_wedding(p_wedding_id) then
    raise exception 'Not allowed to add guests to this wedding';
  end if;

  if p_partner_id is not null then
    perform 1 from public.guests where id = p_partner_id and wedding_id = p_wedding_id;
    if not found then raise exception 'Partner guest is not in this wedding'; end if;
  end if;
  if array_length(p_parent_ids, 1) is not null then
    perform 1 from public.guests where wedding_id = p_wedding_id and id = any(p_parent_ids)
      having count(*) = array_length(p_parent_ids, 1);
    if not found then raise exception 'One or more parents are not in this wedding'; end if;
  end if;
  if array_length(p_group_ids, 1) is not null then
    perform 1 from public.guest_groups where wedding_id = p_wedding_id and id = any(p_group_ids)
      having count(*) = array_length(p_group_ids, 1);
    if not found then raise exception 'One or more groups are not in this wedding'; end if;
  end if;

  insert into public.guests (
    wedding_id, first_name, last_name, email, phone, age_years, role, notes, guest_group
  ) values (
    p_wedding_id, v_first,
    nullif(trim(coalesce(p_last_name, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    p_age_years,
    nullif(trim(coalesce(p_role, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_primary
  ) returning * into v_new;

  foreach v_parent in array coalesce(p_parent_ids, '{}'::uuid[]) loop
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_parent, v_new.id, 'parent_of') on conflict do nothing;
  end loop;

  if p_partner_id is not null then
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_new.id, p_partner_id, 'partner_of'),
           (p_wedding_id, p_partner_id, v_new.id, 'partner_of') on conflict do nothing;
  elsif p_new_partner is not null then
    if nullif(trim(coalesce(p_new_partner ->> 'first_name', '')), '') is null then
      raise exception 'Partner first name is required';
    end if;
    v_partner_group := nullif(trim(coalesce(p_new_partner ->> 'guest_group', '')), '');
    insert into public.guests (
      wedding_id, first_name, last_name, email, phone, age_years, role, notes, guest_group, added_by_guest_id
    ) values (
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
    ) returning id into v_related_id;
    insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
    values (p_wedding_id, v_new.id, v_related_id, 'partner_of'),
           (p_wedding_id, v_related_id, v_new.id, 'partner_of');
    if v_partner_group is not null then
      select id into v_partner_group_id from public.guest_groups
       where wedding_id = p_wedding_id and name = v_partner_group;
      if v_partner_group_id is null then
        insert into public.guest_groups (wedding_id, name) values (p_wedding_id, v_partner_group)
        returning id into v_partner_group_id;
      end if;
      insert into public.guest_group_members (guest_id, group_id)
      values (v_related_id, v_partner_group_id) on conflict do nothing;
    end if;
    -- Multi-group memberships passed as an array of uuid strings.
    if jsonb_typeof(p_new_partner -> 'guest_group_ids') = 'array' then
      for v_gid in
        select (id_text)::uuid
        from jsonb_array_elements_text(p_new_partner -> 'guest_group_ids') as id_text
      loop
        perform 1 from public.guest_groups where id = v_gid and wedding_id = p_wedding_id;
        if not found then raise exception 'Partner group is not in this wedding'; end if;
        insert into public.guest_group_members (guest_id, group_id)
        values (v_related_id, v_gid) on conflict do nothing;
      end loop;
    end if;
  end if;

  if array_length(p_new_children, 1) is not null then
    foreach v_child in array p_new_children loop
      v_child_first := nullif(trim(coalesce(v_child ->> 'first_name', '')), '');
      if v_child_first is null then raise exception 'Every new child needs a first name'; end if;
      v_child_group := nullif(trim(coalesce(v_child ->> 'guest_group', '')), '');
      insert into public.guests (
        wedding_id, first_name, last_name, email, phone, age_years, role, notes, guest_group, added_by_guest_id
      ) values (
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
      ) returning id into v_related_id;
      insert into public.guest_relationships (wedding_id, from_guest, to_guest, kind)
      values (p_wedding_id, v_new.id, v_related_id, 'parent_of');
      if v_child_group is not null then
        select id into v_child_group_id from public.guest_groups
         where wedding_id = p_wedding_id and name = v_child_group;
        if v_child_group_id is null then
          insert into public.guest_groups (wedding_id, name) values (p_wedding_id, v_child_group)
          returning id into v_child_group_id;
        end if;
        insert into public.guest_group_members (guest_id, group_id)
        values (v_related_id, v_child_group_id) on conflict do nothing;
      end if;
      if jsonb_typeof(v_child -> 'guest_group_ids') = 'array' then
        for v_gid in
          select (id_text)::uuid
          from jsonb_array_elements_text(v_child -> 'guest_group_ids') as id_text
        loop
          perform 1 from public.guest_groups where id = v_gid and wedding_id = p_wedding_id;
          if not found then raise exception 'Child group is not in this wedding'; end if;
          insert into public.guest_group_members (guest_id, group_id)
          values (v_related_id, v_gid) on conflict do nothing;
        end loop;
      end if;
    end loop;
  end if;

  if v_primary is not null then
    select id into v_primary_group_id from public.guest_groups
     where wedding_id = p_wedding_id and name = v_primary;
    if v_primary_group_id is null then
      insert into public.guest_groups (wedding_id, name) values (p_wedding_id, v_primary)
      returning id into v_primary_group_id;
    end if;
    insert into public.guest_group_members (guest_id, group_id)
    values (v_new.id, v_primary_group_id) on conflict do nothing;
  end if;

  foreach v_group in array coalesce(p_group_ids, '{}'::uuid[]) loop
    insert into public.guest_group_members (guest_id, group_id)
    values (v_new.id, v_group) on conflict do nothing;
  end loop;

  return v_new;
end;
$$;

-- Team-authorized replacement for public.find_duplicate_groups.
create or replace function public.find_duplicate_groups(p_wedding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_guest    record;
  v_cluster  jsonb;
  v_clusters jsonb := '[]'::jsonb;
  v_row      jsonb;
  v_i        int;
  v_matches  boolean;
  v_member   jsonb;
  v_j        int;
  v_out      jsonb := '[]'::jsonb;
  v_ids      uuid[];
  v_key      text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not union_private.can_access_wedding(p_wedding_id) then raise exception 'Not authorised'; end if;

  for v_guest in
    select g.id, g.first_name, g.last_name, g.age_years, g.email, g.phone,
           g.guest_group, g.role, g.notes, g.added_by_guest_id,
           r.status as rsvp_status,
           ab.first_name as added_by_first_name
      from public.guests g
      left join public.rsvps r on r.guest_id = g.id
      left join public.guests ab on ab.id = g.added_by_guest_id
     where g.wedding_id = p_wedding_id
     order by lower(g.first_name), lower(coalesce(g.last_name, ''))
  loop
    v_row := jsonb_build_object(
      'id',                  v_guest.id,
      'first_name',          v_guest.first_name,
      'last_name',           v_guest.last_name,
      'age_years',           v_guest.age_years,
      'email',               v_guest.email,
      'phone',               v_guest.phone,
      'guest_group',         v_guest.guest_group,
      'role',                v_guest.role,
      'notes',               v_guest.notes,
      'rsvp_status',         coalesce(v_guest.rsvp_status::text, 'pending'),
      'added_by_first_name', v_guest.added_by_first_name
    );

    v_i := 0;
    v_matches := false;
    while v_i < jsonb_array_length(v_clusters) loop
      v_cluster := v_clusters -> v_i;
      v_matches := true;
      v_j := 0;
      while v_j < jsonb_array_length(v_cluster) loop
        v_member := v_cluster -> v_j;
        if not public._guest_matches(
             v_member ->> 'first_name',
             v_member ->> 'last_name',
             nullif(v_member ->> 'age_years', '')::int,
             v_guest.first_name,
             v_guest.last_name,
             v_guest.age_years
           ) then
          v_matches := false;
          exit;
        end if;
        v_j := v_j + 1;
      end loop;

      if v_matches then
        v_clusters := jsonb_set(v_clusters, array[v_i::text], v_cluster || jsonb_build_array(v_row));
        exit;
      end if;
      v_i := v_i + 1;
    end loop;

    if not v_matches then
      v_clusters := v_clusters || jsonb_build_array(jsonb_build_array(v_row));
    end if;
  end loop;

  v_i := 0;
  while v_i < jsonb_array_length(v_clusters) loop
    v_cluster := v_clusters -> v_i;
    if jsonb_array_length(v_cluster) >= 2 then
      select array_agg((m ->> 'id')::uuid)
        into v_ids
        from jsonb_array_elements(v_cluster) as m;
      v_key := public._cluster_key(v_ids);
      if not exists (
        select 1 from public.hidden_merge_clusters h
         where h.wedding_id = p_wedding_id and h.cluster_key = v_key
      ) then
        v_out := v_out || jsonb_build_array(v_cluster);
      end if;
    end if;
    v_i := v_i + 1;
  end loop;

  return v_out;
end;
$$;

-- Team-authorized replacement for public.list_hidden_merge_clusters.
create or replace function public.list_hidden_merge_clusters(p_wedding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_out   jsonb := '[]'::jsonb;
  v_h     record;
  v_ids   uuid[];
  v_arr   jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not union_private.can_access_wedding(p_wedding_id) then raise exception 'Not authorised'; end if;

  for v_h in
    select cluster_key from public.hidden_merge_clusters
     where wedding_id = p_wedding_id order by hidden_at desc
  loop
    v_ids := array(select unnest(string_to_array(v_h.cluster_key, ','))::uuid);
    select coalesce(jsonb_agg(jsonb_build_object(
             'id',                  g.id,
             'first_name',          g.first_name,
             'last_name',           g.last_name,
             'age_years',           g.age_years,
             'email',               g.email,
             'phone',               g.phone,
             'guest_group',         g.guest_group,
             'role',                g.role,
             'notes',               g.notes,
             'rsvp_status',         coalesce(r.status::text, 'pending'),
             'added_by_first_name', ab.first_name
           )), '[]'::jsonb)
      into v_arr
      from public.guests g
      left join public.rsvps r on r.guest_id = g.id
      left join public.guests ab on ab.id = g.added_by_guest_id
     where g.id = any(v_ids);
    if jsonb_array_length(v_arr) = array_length(v_ids, 1) then
      v_out := v_out || jsonb_build_array(v_arr);
    else
      delete from public.hidden_merge_clusters
       where wedding_id = p_wedding_id and cluster_key = v_h.cluster_key;
    end if;
  end loop;

  return v_out;
end;
$$;

-- Team-authorized replacement for public.hide_duplicate_cluster.
create or replace function public.hide_duplicate_cluster(
  p_wedding_id uuid,
  p_guest_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key   text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not union_private.can_access_wedding(p_wedding_id) then
    raise exception 'Not authorised';
  end if;
  if array_length(p_guest_ids, 1) is null or array_length(p_guest_ids, 1) < 2 then
    raise exception 'Need at least two guest ids';
  end if;
  v_key := public._cluster_key(p_guest_ids);
  insert into public.hidden_merge_clusters (wedding_id, cluster_key)
  values (p_wedding_id, v_key)
  on conflict do nothing;
end;
$$;

-- Team-authorized replacement for public.unhide_duplicate_cluster.
create or replace function public.unhide_duplicate_cluster(
  p_wedding_id uuid,
  p_guest_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key   text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not union_private.can_access_wedding(p_wedding_id) then
    raise exception 'Not authorised';
  end if;
  v_key := public._cluster_key(p_guest_ids);
  delete from public.hidden_merge_clusters
   where wedding_id = p_wedding_id and cluster_key = v_key;
end;
$$;

-- Team-authorized replacement for public.owner_merge_guests.
create or replace function public.owner_merge_guests(
  p_source_guest_id uuid,
  p_target_guest_id uuid,
  p_target_overrides jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.guests%rowtype;
  v_target public.guests%rowtype;
  v_merged uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_source from public.guests where id = p_source_guest_id;
  select * into v_target from public.guests where id = p_target_guest_id;
  if v_source.id is null or v_target.id is null then
    raise exception 'Unknown source or target guest';
  end if;
  if v_source.wedding_id <> v_target.wedding_id then
    raise exception 'Guests belong to different weddings';
  end if;

  if not union_private.can_access_wedding(v_source.wedding_id) then
    raise exception 'Not authorised';
  end if;

  if p_target_overrides is not null and jsonb_typeof(p_target_overrides) = 'object' then
    update public.guests set
      first_name  = case when p_target_overrides ? 'first_name'
                         then nullif(trim(coalesce(p_target_overrides ->> 'first_name', '')), '')
                         else first_name end,
      last_name   = case when p_target_overrides ? 'last_name'
                         then nullif(trim(coalesce(p_target_overrides ->> 'last_name', '')), '')
                         else last_name end,
      email       = case when p_target_overrides ? 'email'
                         then nullif(trim(coalesce(p_target_overrides ->> 'email', '')), '')
                         else email end,
      phone       = case when p_target_overrides ? 'phone'
                         then nullif(trim(coalesce(p_target_overrides ->> 'phone', '')), '')
                         else phone end,
      age_years   = case when p_target_overrides ? 'age_years'
                         then nullif(p_target_overrides ->> 'age_years', '')::int
                         else age_years end,
      role        = case when p_target_overrides ? 'role'
                         then nullif(trim(coalesce(p_target_overrides ->> 'role', '')), '')
                         else role end,
      notes       = case when p_target_overrides ? 'notes'
                         then nullif(trim(coalesce(p_target_overrides ->> 'notes', '')), '')
                         else notes end,
      guest_group = case when p_target_overrides ? 'guest_group'
                         then nullif(trim(coalesce(p_target_overrides ->> 'guest_group', '')), '')
                         else guest_group end
    where id = v_target.id;

    -- For fields that _merge_guests folds via COALESCE(target,
    -- source), null out source's copy so a user-chosen null on the
    -- target actually sticks. first_name and age_years aren't in
    -- that COALESCE list, so target's override is already final for
    -- them.
    update public.guests set
      last_name   = case when p_target_overrides ? 'last_name'   then null else last_name   end,
      email       = case when p_target_overrides ? 'email'       then null else email       end,
      phone       = case when p_target_overrides ? 'phone'       then null else phone       end,
      role        = case when p_target_overrides ? 'role'        then null else role        end,
      notes       = case when p_target_overrides ? 'notes'       then null else notes       end,
      guest_group = case when p_target_overrides ? 'guest_group' then null else guest_group end
    where id = v_source.id;
  end if;

  v_merged := public._merge_guests(p_source_guest_id, p_target_guest_id);
  return jsonb_build_object('status', 'merged', 'guest_id', v_merged);
end;
$$;
