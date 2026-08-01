-- ============================================================
-- Union v1 · Guest relationships, kinds, and wedding-level
-- "who can add whom" toggles.
--
-- Retires the anonymous "party_size" counter: every attendee
-- (including a child, +1, or teen who got their own invite
-- later) is now a first-class guest row. Extras are represented
-- as linked light guests — a guest row with kind='child' and
-- no email/phone is a light guest; promoting a teen to their
-- own login just means setting kind='adult' and attaching
-- contact info + profile_id, without touching the parent_of
-- edges.
--
-- Registration permission is derived, not stored on relationships:
--     wedding.allow_guests_add_partner / allow_guests_add_kids
--   overridden per-guest by
--     guests.can_add_partner / can_add_kids  (null = inherit)
-- The RPCs in the next migration are where that derivation lives.
-- ============================================================

-- ---------- enums ----------
create type public.guest_kind as enum ('adult', 'child');
create type public.guest_relationship_kind as enum ('parent_of', 'partner_of');

-- ---------- guests: new columns ----------
alter table public.guests
  add column kind public.guest_kind not null default 'adult',
  add column added_by_guest_id uuid references public.guests(id) on delete set null,
  add column profile_id uuid references public.profiles(id) on delete set null,
  add column can_add_partner boolean,
  add column can_add_kids boolean;

create index guests_added_by_guest_id_idx on public.guests (added_by_guest_id);
create index guests_profile_id_idx on public.guests (profile_id);
create index guests_kind_idx on public.guests (wedding_id, kind);

-- Drop the counter: each attendee is now their own row.
alter table public.guests drop column party_size;
alter table public.rsvps  drop column num_attending;

-- ---------- guest_relationships ----------
-- Directed edges. partner_of is stored as two rows (A→B and B→A)
-- so "who can register X" is always a single lookup.
-- Denormalised wedding_id lets RLS and index scans stay cheap
-- without a join on either endpoint.
create table public.guest_relationships (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  from_guest uuid not null references public.guests(id) on delete cascade,
  to_guest   uuid not null references public.guests(id) on delete cascade,
  kind       public.guest_relationship_kind not null,
  created_at timestamptz not null default now(),
  primary key (from_guest, to_guest, kind),
  check (from_guest <> to_guest)
);
alter table public.guest_relationships enable row level security;
create index guest_relationships_wedding_id_idx on public.guest_relationships (wedding_id);
create index guest_relationships_to_guest_idx on public.guest_relationships (to_guest, kind);

-- ---------- weddings: registration toggles ----------
alter table public.weddings
  add column allow_guests_add_partner boolean not null default false,
  add column allow_guests_add_kids    boolean not null default false,
  -- null = no cap; 0 = disabled (redundant with allow_guests_add_kids=false)
  add column max_kids_per_guest       int check (max_kids_per_guest is null or max_kids_per_guest >= 0);

-- ============================================================
-- RLS (owner-scoped, matches the pattern used everywhere else)
-- ============================================================

create policy "Guest relationships selectable by wedding owner"
  on public.guest_relationships for select
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_relationships.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guest relationships insertable by wedding owner"
  on public.guest_relationships for insert
  with check (exists (
    select 1 from public.weddings w
    where w.id = guest_relationships.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guest relationships updatable by wedding owner"
  on public.guest_relationships for update
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_relationships.wedding_id and w.owner_id = auth.uid()
  ));
create policy "Guest relationships deletable by wedding owner"
  on public.guest_relationships for delete
  using (exists (
    select 1 from public.weddings w
    where w.id = guest_relationships.wedding_id and w.owner_id = auth.uid()
  ));
