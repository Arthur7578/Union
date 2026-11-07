-- ============================================================
-- Wedding page parts: the guest modules become the parts of
-- the wedding page
--
-- The guest hub showed four modules (forms, travel, logistics,
-- faq). Delivery 2 of the wedding page replaces that hub with one
-- page: the faire-part in its envelope opens it, then the parts
-- the couple turns on, then the reply, which is always there.
--
--   word      Le mot (the couple's text and the countdown)
--   weekend   Le week-end (the moments, add to calendar)
--   venue     Le lieu et venir (venue, getting there, stays)
--   travel    Covoiturage (unchanged; see issue #109)
--   dress     La tenue (dress code and palette)
--   faq       Questions
--
-- What changes, and why:
--   * "logistics" is split into "weekend" and "venue": the page
--     shows the schedule and the venue as two parts. A wedding
--     that had turned logistics off keeps both of them off.
--   * "forms" goes: the reply (and the couple's other forms
--     under it) is always on the page. Without it a guest had no
--     way to answer, which was never a useful configuration.
--   * The "at least one module" rule goes with it: every part can
--     be off, and the page is then the faire-part and the reply.
--
-- An absent key still means "on", as before. A part with nothing
-- written in it is left out of the page by the guest app, so a
-- part being on does not by itself show anything new to guests.
-- ============================================================

-- The constraint calls the validator, so it goes first: rows are
-- rewritten under the new key set, then the validator and the
-- constraint come back with it.
alter table public.weddings
  drop constraint if exists weddings_guest_modules_valid;

-- ---------- existing choices, translated ----------
update public.weddings
   set guest_modules =
         (guest_modules - 'forms' - 'logistics')
         || case
              when guest_modules -> 'logistics' = 'false'::jsonb
                then '{"weekend": false, "venue": false}'::jsonb
              else '{}'::jsonb
            end
 where guest_modules ?| array['forms', 'logistics'];

-- ---------- shape guard ----------
create or replace function public._guest_modules_valid(p_modules jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_modules is null
     or (
          jsonb_typeof(p_modules) = 'object'
          -- Every key names a part the page renders, and every value
          -- is a plain boolean: a typo'd key would sit in the row
          -- looking effective while changing nothing.
          and not exists (
            select 1
            from jsonb_each(p_modules) as e
            where e.key not in ('word', 'weekend', 'venue', 'travel', 'dress', 'faq')
               or jsonb_typeof(e.value) <> 'boolean'
          )
        );
$$;

comment on function public._guest_modules_valid(jsonb) is
  'True when a weddings.guest_modules map is well formed: an object of known wedding page part keys to booleans. Absent key means on. Every part may be off.';

alter table public.weddings
  add constraint weddings_guest_modules_valid
  check (public._guest_modules_valid(guest_modules));

comment on column public.weddings.guest_modules is
  'Which parts of the wedding page guests see, as a map of part key to boolean. Only the couple''s "off" decisions are stored: an absent key means the part is on. Keys: word, weekend, venue, travel, dress, faq. The faire-part and the reply are always shown.';
