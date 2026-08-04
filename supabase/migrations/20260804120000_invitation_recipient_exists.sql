-- An invitation email has two Auth paths:
--   * existing Union users receive the ordinary passwordless sign-in email;
--   * new users must be created through auth.admin.inviteUserByEmail.
--
-- The application deliberately has no public access to auth.users. Expose only
-- the one bit the invite route needs, and only to the wedding owner after the
-- matching pending collaborator row has been saved. This prevents the function
-- from becoming a general account-enumeration endpoint.
create or replace function public.invitation_recipient_exists(
  p_wedding_id uuid,
  p_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from auth.users u
      where lower(u.email) = lower(trim(p_email))
    )
    and exists (
      select 1
      from public.weddings w
      join public.wedding_collaborators c
        on c.wedding_id = w.id
      where w.id = p_wedding_id
        and w.owner_id = auth.uid()
        and c.status = 'pending'
        and lower(c.email) = lower(trim(p_email))
    );
$$;

revoke all on function public.invitation_recipient_exists(uuid, text)
  from public, anon;
grant execute on function public.invitation_recipient_exists(uuid, text)
  to authenticated;
