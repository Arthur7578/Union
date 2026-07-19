-- ============================================================
-- Union v1 · Guests feature made operational
--
-- Adds the schema the /guests sub-screens need in order to stop
-- rendering from sample data:
--
--   * guests.role                    -- optional wedding-party role
--   * guests.notes                   -- owner-only note about a guest
--   * guests.rsvp_reminder_sent_at   -- last time a nudge was fired
--   * weddings.rsvp_form_questions   -- custom RSVP questions (jsonb)
--
--   * guest_groups                   -- name + colour meta per group
--   * room_blocks + guests.room_block_id  -- Stays
--   * seating_tables + guests.seating_table_id  -- Seating
--
-- Every new table is owner-scoped through the parent wedding.
-- ============================================================

-- ---------- guests: new columns ----------
alter table public.guests
  add column if not exists role text,
  add column if not exists notes text,
  add column if not exists rsvp_reminder_sent_at timestamptz;

-- ---------- weddings: RSVP-form question configuration ----------
-- Shape: [{"id":"uuid","kind":"single|multi|short|comment","title":"...","required":bool,"options":["..."]}]
alter table public.weddings
  add column if not exists rsvp_form_questions jsonb;

-- ---------- guest_groups ----------
-- The `guests.guest_group` text column stays the source of truth for
-- which group a guest belongs to; this table just persists per-group
-- meta (colour + display order). Names are matched case-sensitively
-- so the on-screen label always matches what's on the guest row.
create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (wedding_id, name)
);
alter table public.guest_groups enable row level security;
create index if not exists guest_groups_wedding_id_idx on public.guest_groups (wedding_id);

-- ---------- room_blocks (Stays) ----------
create table if not exists public.room_blocks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null,
  note text,
  price_note text,
  status text,
  capacity_rooms int not null default 0,
  booked_rooms int not null default 0,
  tone text not null default 'accent',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.room_blocks enable row level security;
create index if not exists room_blocks_wedding_id_idx on public.room_blocks (wedding_id);

alter table public.guests
  add column if not exists room_block_id uuid references public.room_blocks (id) on delete set null;
create index if not exists guests_room_block_id_idx on public.guests (room_block_id);

-- ---------- seating_tables ----------
create table if not exists public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null,
  capacity int not null default 8 check (capacity >= 1),
  x_pct numeric not null default 50,
  y_pct numeric not null default 50,
  tone text not null default 'accent',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.seating_tables enable row level security;
create index if not exists seating_tables_wedding_id_idx on public.seating_tables (wedding_id);

alter table public.guests
  add column if not exists seating_table_id uuid references public.seating_tables (id) on delete set null;
create index if not exists guests_seating_table_id_idx on public.guests (seating_table_id);

-- ============================================================
-- RLS policies (owner-scoped via the parent wedding)
-- ============================================================

-- rsvps: the owner can also delete a recorded reply to reset a guest to
-- "awaiting". The 0001 migration only granted select/insert/update.
drop policy if exists "Rsvps deletable by wedding owner" on public.rsvps;
create policy "Rsvps deletable by wedding owner"
  on public.rsvps for delete
  using (exists (
    select 1 from public.guests g
    join public.weddings w on w.id = g.wedding_id
    where g.id = rsvps.guest_id and w.owner_id = auth.uid()
  ));

-- guest_groups
drop policy if exists "Guest groups selectable by wedding owner" on public.guest_groups;
drop policy if exists "Guest groups insertable by wedding owner" on public.guest_groups;
drop policy if exists "Guest groups updatable by wedding owner" on public.guest_groups;
drop policy if exists "Guest groups deletable by wedding owner" on public.guest_groups;

create policy "Guest groups selectable by wedding owner"
  on public.guest_groups for select
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_groups.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guest groups insertable by wedding owner"
  on public.guest_groups for insert
  with check (exists (
    select 1 from public.weddings w
    where w.id = guest_groups.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guest groups updatable by wedding owner"
  on public.guest_groups for update
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_groups.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guest groups deletable by wedding owner"
  on public.guest_groups for delete
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_groups.wedding_id and w.owner_id = auth.uid()
  ));

-- room_blocks
drop policy if exists "Room blocks selectable by wedding owner" on public.room_blocks;
drop policy if exists "Room blocks insertable by wedding owner" on public.room_blocks;
drop policy if exists "Room blocks updatable by wedding owner" on public.room_blocks;
drop policy if exists "Room blocks deletable by wedding owner" on public.room_blocks;

create policy "Room blocks selectable by wedding owner"
  on public.room_blocks for select
  using (exists (
    select 1 from public.weddings w
    where w.id = room_blocks.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Room blocks insertable by wedding owner"
  on public.room_blocks for insert
  with check (exists (
    select 1 from public.weddings w
    where w.id = room_blocks.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Room blocks updatable by wedding owner"
  on public.room_blocks for update
  using (exists (
    select 1 from public.weddings w
    where w.id = room_blocks.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Room blocks deletable by wedding owner"
  on public.room_blocks for delete
  using (exists (
    select 1 from public.weddings w
    where w.id = room_blocks.wedding_id and w.owner_id = auth.uid()
  ));

-- seating_tables
drop policy if exists "Seating tables selectable by wedding owner" on public.seating_tables;
drop policy if exists "Seating tables insertable by wedding owner" on public.seating_tables;
drop policy if exists "Seating tables updatable by wedding owner" on public.seating_tables;
drop policy if exists "Seating tables deletable by wedding owner" on public.seating_tables;

create policy "Seating tables selectable by wedding owner"
  on public.seating_tables for select
  using (exists (
    select 1 from public.weddings w
    where w.id = seating_tables.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Seating tables insertable by wedding owner"
  on public.seating_tables for insert
  with check (exists (
    select 1 from public.weddings w
    where w.id = seating_tables.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Seating tables updatable by wedding owner"
  on public.seating_tables for update
  using (exists (
    select 1 from public.weddings w
    where w.id = seating_tables.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Seating tables deletable by wedding owner"
  on public.seating_tables for delete
  using (exists (
    select 1 from public.weddings w
    where w.id = seating_tables.wedding_id and w.owner_id = auth.uid()
  ));
