begin;

-- Guard on everything a signed-out visitor (anon) can reach.
--
--  1. Tables: RLS is on everywhere, and anon has no privilege on any table,
--     view or sequence in public, existing or created later.
--  2. Functions: anon can execute exactly the guest-link and group-link
--     RPCs probed below plus the few listed exceptions (keepalive), and
--     functions created later are closed to it.
--  3. Probes: each of those RPCs is called as anon with a key that opens
--     nothing (an unknown token or join code, then a null one) and must
--     change no data in public and return nothing of the seeded wedding.
--
-- If this test fails on a new function: add
-- `revoke execute on function … from public, anon;` to its migration (see
-- CLAUDE.md, "Database migrations"). Only if signed-out guests really call
-- it, grant it to anon and add a probe for it in pg_temp.anon_probes.

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

-- ---------- a wedding whose data must never leak ----------

insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000090', 'canary-owner@example.test');

insert into public.weddings (id, owner_id, partner_one, partner_two, event_date, join_code)
values ('20000000-0000-0000-0000-000000000090', '10000000-0000-0000-0000-000000000090',
        'Canaryone', 'Canarytwo', '2027-06-12', 'canary-code');

insert into public.guests (id, wedding_id, invite_token, first_name, last_name, email)
values ('30000000-0000-0000-0000-000000000090', '20000000-0000-0000-0000-000000000090',
        '40000000-0000-0000-0000-000000000090', 'Canaryguest', 'Canaryfamily', 'canary-guest@example.test');

insert into public.forms (id, wedding_id, title)
values ('50000000-0000-0000-0000-000000000090', '20000000-0000-0000-0000-000000000090', 'Canaryform');

-- ---------- 1. tables ----------

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every table in public has row level security on'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
         or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete')
         or has_table_privilege('anon', c.oid, 'truncate') or has_table_privilege('anon', c.oid, 'references')
         or has_table_privilege('anon', c.oid, 'trigger')) $$,
  'anon has no privilege on any table or view in public'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'S'
       and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('anon', c.oid, 'select')
         or has_sequence_privilege('anon', c.oid, 'update')) $$,
  'anon has no privilege on any sequence in public'
);

create table public._anon_guard_probe_table (id int);
create function public._anon_guard_probe_fn() returns int language sql as $$ select 1 $$;

select ok(
  not has_table_privilege('anon', 'public._anon_guard_probe_table', 'select')
  and not has_table_privilege('anon', 'public._anon_guard_probe_table', 'insert'),
  'a table created later is closed to anon by default'
);

select ok(
  not has_function_privilege('anon', 'public._anon_guard_probe_fn()', 'execute'),
  'a function created later is closed to anon by default'
);

select ok(
  has_function_privilege('authenticated', 'public._guest_modules_valid(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public._rsvp_fields_valid(jsonb)', 'execute'),
  'signed-in organisers can still run the check-constraint helpers anon lost'
);

drop table public._anon_guard_probe_table;
drop function public._anon_guard_probe_fn();

-- ---------- 2. functions anon can call ----------

-- One probe per anon-callable RPC; {key} is replaced by an unknown key,
-- then by null. Other arguments point at the canary wedding where they can.
create temp table anon_probes (fn text primary key, call text not null);
insert into anon_probes (fn, call) values
  ('check_join_email',          $$ public.check_join_email({code}, '30000000-0000-0000-0000-000000000090', 'canary-guest@example.test') $$),
  ('find_guest_for_join',       $$ public.find_guest_for_join({code}, 'Canaryguest', 'Canaryfamily') $$),
  ('get_wedding_by_join_code',  $$ public.get_wedding_by_join_code({code}) $$),
  ('get_guest_email_status',    $$ public.get_guest_email_status({token}) $$),
  ('get_guest_page',            $$ public.get_guest_page({token}) $$),
  ('get_invitation',            $$ public.get_invitation({token}) $$),
  ('get_invitation_rsvp_forms', $$ public.get_invitation_rsvp_forms({token}) $$),
  ('mark_welcome_seen',         $$ public.mark_welcome_seen({token}) $$),
  ('rsvp_merge_into',           $$ public.rsvp_merge_into({token}, '30000000-0000-0000-0000-000000000090') $$),
  ('rsvp_register_companion',   $$ public.rsvp_register_companion({token}, 'partner', 'Intruder', 'Canaryfamily', 'force_create') $$),
  ('set_guest_email',           $$ public.set_guest_email({token}, 'intruder@example.test') $$),
  ('set_guest_locale',          $$ public.set_guest_locale({token}, 'en') $$),
  ('submit_companion_rsvp',     $$ public.submit_companion_rsvp({token}, '30000000-0000-0000-0000-000000000090', 'declined', 'intruder') $$),
  ('submit_form_response',      $$ public.submit_form_response({token}, '50000000-0000-0000-0000-000000000090', '{}'::jsonb, '30000000-0000-0000-0000-000000000090') $$),
  ('submit_rsvp',               $$ public.submit_rsvp({token}, 'declined', 'intruder', 'intruder') $$),
  ('submit_rsvp_response',      $$ public.submit_rsvp_response({token}, '50000000-0000-0000-0000-000000000090', 'declined', '[]'::jsonb, '{}'::jsonb) $$);

-- Anon-callable functions that are not guest RPCs, each with its reason.
-- They take no key, so they are not probed here; their own test covers them.
create temp table anon_exceptions (fn text primary key, reason text not null);
insert into anon_exceptions (fn, reason) values
  ('keepalive_ping', 'GitHub keepalive job, publishable key only; bumps the one-row keepalive table (20261123120000, keepalive_ping.test.sql)');

select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  $$ select fn from anon_probes union all select fn from anon_exceptions $$,
  'anon can execute exactly the probed guest-link and group-link functions and the listed exceptions'
);

select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
       and p.proname not in (select fn from anon_exceptions)
       and (p.proargnames is null or p.proargnames[1] not in ('p_token', 'p_join_code')) $$,
  'every guest function anon can call takes a guest token or a join code first'
);

-- ---------- 3. probes ----------

-- A fingerprint of every row in public, read as the table owner (past RLS).
create function pg_temp.public_fingerprint() returns text
language plpgsql security definer as $$
declare
  v_rel regclass;
  v_part text;
  v_all text := '';
begin
  for v_rel in
    select c.oid::regclass from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1
  loop
    execute format('select coalesce(md5(string_agg(t::text, %L order by t::text)), %L) from %s t', '|', '', v_rel)
      into v_part;
    v_all := v_all || v_rel::text || ':' || v_part || ';';
  end loop;
  return md5(v_all);
end;
$$;

-- Runs every probe with the given keys; returns one line per probe that
-- changed data or returned canary data. A probe that raises is fine: the
-- exception rolls back whatever it did.
create function pg_temp.run_anon_probes(p_token text, p_code text) returns setof text
language plpgsql as $$
declare
  v_probe record;
  v_sql text;
  v_out text;
begin
  for v_probe in select fn, call from anon_probes order by fn loop
    v_sql := replace(replace(v_probe.call, '{token}', p_token), '{code}', p_code);
    begin
      execute format('select coalesce(string_agg(r::text, %L), %L) from %s as r', ',', '', v_sql) into v_out;
    exception when others then
      v_out := '';
    end;
    if pg_temp.public_fingerprint() is distinct from current_setting('anon_guard.fingerprint') then
      return next v_probe.fn || ' changed data';
      perform set_config('anon_guard.fingerprint', pg_temp.public_fingerprint(), true);
    end if;
    if v_out ~* 'canary' or v_out like '%-000000000090%' then
      return next v_probe.fn || ' returned canary data: ' || left(v_out, 200);
    end if;
  end loop;
end;
$$;

grant execute on function pg_temp.public_fingerprint() to anon;
grant execute on function pg_temp.run_anon_probes(text, text) to anon;
grant select on anon_probes to anon;

do $$ begin perform set_config('anon_guard.fingerprint', pg_temp.public_fingerprint(), true); end $$;

set local role anon;

select is_empty(
  $$ select pg_temp.run_anon_probes('''99999999-9999-4999-8999-999999999999''::uuid', '''not-a-code''') $$,
  'with an unknown token or join code, no guest RPC changes data or returns the wedding'
);

select is_empty(
  $$ select pg_temp.run_anon_probes('null::uuid', 'null::text') $$,
  'with a null token or join code, no guest RPC changes data or returns the wedding'
);

select is_empty(
  $$ select pg_temp.run_anon_probes('null::uuid', $q$''$q$) $$,
  'with an empty join code, no guest RPC changes data or returns the wedding'
);

reset role;

-- The probes are not blind: the real key does open the canary invitation.
set local role anon;
select ok(
  (select coalesce(string_agg(r::text, ','), '') from public.get_invitation('40000000-0000-0000-0000-000000000090'::uuid) r) ~* 'canary',
  'the real token does return the invitation, so the leak check can see canary data'
);
reset role;

select * from finish();
rollback;
