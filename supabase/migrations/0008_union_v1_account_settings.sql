-- ============================================================
-- Union v1 · Account & wedding-settings fields
--
-- Backs the new "You" / "Your wedding" screens: a phone number on
-- the profile, and the wedding facts (guest-count target, style &
-- vibe) that the onboarding flow doesn't collect yet.
-- ============================================================

alter table public.profiles
  add column if not exists phone text;

alter table public.weddings
  add column if not exists guest_count_target int,
  add column if not exists style_vibe text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'weddings_guest_count_target_positive'
  ) then
    alter table public.weddings
      add constraint weddings_guest_count_target_positive
      check (guest_count_target is null or guest_count_target >= 0);
  end if;
end $$;
