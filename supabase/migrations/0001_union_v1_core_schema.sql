-- ============================================================
-- Union v1 core schema: profiles, weddings, guests, rsvps
-- ============================================================

-- Enum for RSVP status
create type public.rsvp_status as enum ('pending', 'attending', 'declined');

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ---------- weddings ----------
create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  partner_one text,
  partner_two text,
  event_date date,
  venue_name text,
  venue_address text,
  created_at timestamptz not null default now()
);
alter table public.weddings enable row level security;
create index weddings_owner_id_idx on public.weddings (owner_id);

-- ---------- guests ----------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  party_size int not null default 1 check (party_size >= 1),
  guest_group text,
  invite_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.guests enable row level security;
create index guests_wedding_id_idx on public.guests (wedding_id);

-- ---------- rsvps ----------
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guests (id) on delete cascade,
  status public.rsvp_status not null default 'pending',
  num_attending int check (num_attending >= 0),
  dietary_notes text,
  message text,
  responded_at timestamptz
);
alter table public.rsvps enable row level security;
create index rsvps_guest_id_idx on public.rsvps (guest_id);

-- ============================================================
-- Auto-create a profile when a new auth user is created
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS policies (owner-scoped)
-- ============================================================

-- profiles: a user manages their own profile row
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);
create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- weddings: owner has full access
create policy "Weddings selectable by owner"
  on public.weddings for select
  using (auth.uid() = owner_id);
create policy "Weddings insertable by owner"
  on public.weddings for insert
  with check (auth.uid() = owner_id);
create policy "Weddings updatable by owner"
  on public.weddings for update
  using (auth.uid() = owner_id);
create policy "Weddings deletable by owner"
  on public.weddings for delete
  using (auth.uid() = owner_id);

-- guests: access if the guest belongs to a wedding owned by the user
create policy "Guests selectable by wedding owner"
  on public.guests for select
  using (exists (
    select 1 from public.weddings w
    where w.id = guests.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guests insertable by wedding owner"
  on public.guests for insert
  with check (exists (
    select 1 from public.weddings w
    where w.id = guests.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guests updatable by wedding owner"
  on public.guests for update
  using (exists (
    select 1 from public.weddings w
    where w.id = guests.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guests deletable by wedding owner"
  on public.guests for delete
  using (exists (
    select 1 from public.weddings w
    where w.id = guests.wedding_id and w.owner_id = auth.uid()
  ));

-- rsvps: access if the rsvp's guest belongs to the user's wedding
create policy "Rsvps selectable by wedding owner"
  on public.rsvps for select
  using (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = rsvps.guest_id and w.owner_id = auth.uid()
  ));
create policy "Rsvps insertable by wedding owner"
  on public.rsvps for insert
  with check (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = rsvps.guest_id and w.owner_id = auth.uid()
  ));
create policy "Rsvps updatable by wedding owner"
  on public.rsvps for update
  using (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = rsvps.guest_id and w.owner_id = auth.uid()
  ));
