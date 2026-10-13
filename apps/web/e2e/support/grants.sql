-- The table privileges the hosted project gives the API roles on every table
-- in public (Supabase's defaults there; none of our migrations grant them).
-- A database built from the migrations alone with the local CLI doesn't get
-- them, so the browser tests apply the same grants to their local database
-- before running. Row level security still decides what each role can see.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
