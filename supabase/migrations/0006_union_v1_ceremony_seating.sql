-- ============================================================
-- Union v1 · Ceremony seating on the guest row
--
-- Adds a tiny two-column shape to `guests` so a couple can put
-- specific people in specific ceremony pews (one row, one side).
-- Both null = not assigned; both set = pew assignment.
--
-- Everything is additive with sane defaults so pre-existing rows
-- keep behaving as "unassigned".
-- ============================================================

alter table public.guests
  add column if not exists ceremony_row int,
  add column if not exists ceremony_side text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'guests_ceremony_side_check'
  ) then
    alter table public.guests
      add constraint guests_ceremony_side_check
      check (ceremony_side is null or ceremony_side in ('left', 'right'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'guests_ceremony_seat_pair_check'
  ) then
    alter table public.guests
      add constraint guests_ceremony_seat_pair_check
      check ((ceremony_row is null) = (ceremony_side is null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'guests_ceremony_row_nonneg'
  ) then
    alter table public.guests
      add constraint guests_ceremony_row_nonneg
      check (ceremony_row is null or ceremony_row >= 0);
  end if;
end $$;

create index if not exists guests_ceremony_pew_idx
  on public.guests (wedding_id, ceremony_row, ceremony_side)
  where ceremony_row is not null;
