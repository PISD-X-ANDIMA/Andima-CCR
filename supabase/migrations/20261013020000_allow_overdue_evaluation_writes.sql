grant insert, update on public.c1_overdue_alert to authenticated;

drop policy if exists "Users create overdue alerts" on public.c1_overdue_alert;
create policy "Users create overdue alerts" on public.c1_overdue_alert
  for insert to authenticated
  with check (exists (
    select 1
    from public.d3_user_access
    where auth_user_id = auth.uid()
      and app_role::text in ('HR', 'MANAGER')
  ));

drop policy if exists "Users update overdue alerts" on public.c1_overdue_alert;
create policy "Users update overdue alerts" on public.c1_overdue_alert
  for update to authenticated
  using (exists (
    select 1
    from public.d3_user_access
    where auth_user_id = auth.uid()
      and app_role::text in ('HR', 'MANAGER')
  ))
  with check (exists (
    select 1
    from public.d3_user_access
    where auth_user_id = auth.uid()
      and app_role::text in ('HR', 'MANAGER')
  ));
