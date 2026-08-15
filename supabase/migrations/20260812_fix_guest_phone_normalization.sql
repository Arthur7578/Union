-- ============================================================
-- Union v1 · Make guest phone normalization reproducible
--
-- The live database had this function and generated column, but
-- they were missing from migration history. The function's
-- EXECUTE privilege was also revoked from `authenticated`, so
-- every guest INSERT or UPDATE failed when PostgreSQL recomputed
-- the stored generated column.
-- ============================================================

create or replace function public._normalize_guest_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  with cleaned as (
    select
      trim(coalesce(p_phone, '')) as raw,
      regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits
  )
  select case
    when length(digits) < 8 or length(digits) > 15 then null
    when raw like '+%' then '+' || digits
    when digits like '00%' then '+' || substr(digits, 3)
    when length(digits) = 11 and digits like '33%' then '+' || digits
    when length(digits) = 10 and digits like '0%' then '+33' || substr(digits, 2)
    when length(digits) = 9 and digits ~ '^[1-9]' then '+33' || digits
    else null
  end
  from cleaned;
$$;

-- Keep the helper private to database writes. The service role is
-- used by privileged server flows, while authenticated is required
-- for owner-side guest writes through the Data API.
revoke all on function public._normalize_guest_phone(text) from public, anon;
grant execute on function public._normalize_guest_phone(text)
  to authenticated, service_role;

alter table public.guests
  add column if not exists phone_e164 text
  generated always as (public._normalize_guest_phone(phone)) stored;

create index if not exists guests_wedding_phone_e164_idx
  on public.guests (wedding_id, phone_e164)
  where phone_e164 is not null;
