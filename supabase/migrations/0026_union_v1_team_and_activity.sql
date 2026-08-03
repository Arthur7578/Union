-- ============================================================
-- Union v1 · Live team & activity
--
-- Backs the "who's planning" entry point and /plan/team with real
-- rows instead of the sample fixtures in lib/sample.ts:
--   - wedding_collaborators: people invited to help plan, beyond the
--     owner. A row starts 'pending' and flips to 'active' (via
--     accept_pending_invites, below) the moment that email signs in.
--   - activity_log: "who did what", populated by triggers off the
--     actions that already happen elsewhere in the schema — a guest
--     added, an RSVP recorded, someone invited or joining, the
--     autonomy dial changed. Union doesn't act on anything in this
--     schema on its own yet, so every row is attributed to a person;
--     no fabricated "Union did X" rows are inserted here.
--   - weddings.autonomy: the persisted "how much Union does on its
--     own" setting, moved here from being purely client-side state.
-- ============================================================

-- ---------- weddings.autonomy ----------
alter table public.weddings
  add column if not exists autonomy text not null default 'ask';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_autonomy_valid'
  ) then
    alter table public.weddings
      add constraint weddings_autonomy_valid
      check (autonomy in ('ask', 'suggest', 'auto'));
  end if;
end $$;

-- ---------- wedding_collaborators ----------
create table public.wedding_collaborators (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz
);
alter table public.wedding_collaborators enable row level security;
create index wedding_collaborators_wedding_id_idx on public.wedding_collaborators (wedding_id);
create unique index wedding_collaborators_wedding_email_idx
  on public.wedding_collaborators (wedding_id, lower(email));

create policy "Collaborators manageable by wedding owner"
  on public.wedding_collaborators for all
  using (exists (
    select 1 from public.weddings w
    where w.id = wedding_collaborators.wedding_id and w.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.weddings w
    where w.id = wedding_collaborators.wedding_id and w.owner_id = auth.uid()
  ));

-- An invited person can see their own invite by email before they ever
-- sign in — needed so a future "you've been invited" screen can look
-- this up. auth.jwt() reads straight off the current session's claims.
create policy "Invitee can read their own invite"
  on public.wedding_collaborators for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------- activity_log ----------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  actor_kind text not null check (actor_kind in ('person', 'union')),
  actor_label text not null,
  action_text text not null,
  created_at timestamptz not null default now()
);
alter table public.activity_log enable row level security;
create index activity_log_wedding_id_idx on public.activity_log (wedding_id, created_at desc);

create policy "Activity selectable by wedding owner"
  on public.activity_log for select
  using (exists (
    select 1 from public.weddings w
    where w.id = activity_log.wedding_id and w.owner_id = auth.uid()
  ));

create policy "Activity selectable by active collaborators"
  on public.activity_log for select
  using (exists (
    select 1 from public.wedding_collaborators c
    where c.wedding_id = activity_log.wedding_id
      and c.user_id = auth.uid()
      and c.status = 'active'
  ));

-- ---------- helper: whose name goes on an activity row ----------
create or replace function public.current_actor_label(p_wedding_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select full_name from public.profiles where id = auth.uid()),
    (select partner_one from public.weddings where id = p_wedding_id),
    'Someone'
  );
$$;

-- ---------- triggers: log real actions as they happen ----------

create or replace function public.log_guest_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (wedding_id, actor_kind, actor_label, action_text)
  values (
    new.wedding_id,
    'person',
    public.current_actor_label(new.wedding_id),
    'added ' || trim(new.first_name || ' ' || coalesce(new.last_name, '')) || ' as a guest'
  );
  return new;
end;
$$;

create trigger guests_log_activity
  after insert on public.guests
  for each row execute function public.log_guest_added();

create or replace function public.log_rsvp_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest_name text;
begin
  if TG_OP = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('attending', 'declined') then
    return new;
  end if;

  select trim(first_name || ' ' || coalesce(last_name, '')) into v_guest_name
  from public.guests where id = new.guest_id;

  insert into public.activity_log (wedding_id, actor_kind, actor_label, action_text)
  select
    g.wedding_id,
    'person',
    coalesce(v_guest_name, 'A guest'),
    case new.status when 'attending' then 'RSVP''d yes' else 'RSVP''d no' end
  from public.guests g where g.id = new.guest_id;

  return new;
end;
$$;

create trigger rsvps_log_activity
  after insert or update on public.rsvps
  for each row execute function public.log_rsvp_status_change();

create or replace function public.log_collaborator_invited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (wedding_id, actor_kind, actor_label, action_text)
  values (
    new.wedding_id,
    'person',
    public.current_actor_label(new.wedding_id),
    'invited ' || new.email || ' to plan together'
  );
  return new;
end;
$$;

create trigger collaborators_log_invited
  after insert on public.wedding_collaborators
  for each row execute function public.log_collaborator_invited();

create or replace function public.log_collaborator_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status = 'pending' then
    insert into public.activity_log (wedding_id, actor_kind, actor_label, action_text)
    values (
      new.wedding_id,
      'person',
      coalesce((select full_name from public.profiles where id = new.user_id), new.email),
      'joined to plan together'
    );
  end if;
  return new;
end;
$$;

create trigger collaborators_log_joined
  after update on public.wedding_collaborators
  for each row execute function public.log_collaborator_joined();

create or replace function public.log_autonomy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.autonomy is distinct from old.autonomy then
    insert into public.activity_log (wedding_id, actor_kind, actor_label, action_text)
    values (
      new.id,
      'person',
      public.current_actor_label(new.id),
      'set how much Union does on its own to "' || new.autonomy || '"'
    );
  end if;
  return new;
end;
$$;

create trigger weddings_log_autonomy_change
  after update on public.weddings
  for each row execute function public.log_autonomy_change();

-- ---------- accepting an invite ----------
-- Call once right after sign-in. Flips any pending invite addressed to
-- the signed-in person's email into an active collaborator tied to
-- their profile. A no-op when nothing is pending for that email.
create or replace function public.accept_pending_invites()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email = '' then
    return;
  end if;
  update public.wedding_collaborators
  set status = 'active', user_id = auth.uid(), joined_at = now()
  where lower(email) = v_email and status = 'pending';
end;
$$;

grant execute on function public.accept_pending_invites() to authenticated;
