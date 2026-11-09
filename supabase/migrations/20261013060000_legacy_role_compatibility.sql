-- Existing D3 policies call d3_current_role() and still use the legacy
-- HR/MANAGER names. Keep those policies functional while stored access rows use
-- STAFF/MANAGEMENT as the business-facing categories.
create or replace function public.d3_current_role()
returns public.d3_app_role
language sql
stable
set search_path = public, pg_temp
as $$
  select case dua.app_role::text
    when 'STAFF' then 'HR'::public.d3_app_role
    when 'MANAGEMENT' then 'MANAGER'::public.d3_app_role
    else dua.app_role
  end
  from public.d3_user_access dua
  where dua.auth_user_id = auth.uid()
  limit 1;
$$;
