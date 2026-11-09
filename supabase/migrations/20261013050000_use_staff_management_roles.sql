-- Role categories are derived from d3_positions. Unknown positions receive the
-- least-privileged application category, STAFF, instead of the legacy EMPLOYEE.
create or replace function public.d3_role_for_position(p_position_id uuid)
returns public.d3_app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when lower(trim(position.title)) in (
          'director of finance, accounting & digital transformation',
          'manager of accounting',
          'manager of customer success'
        ) then 'MANAGEMENT'::public.d3_app_role
        else 'STAFF'::public.d3_app_role
      end
      from public.d3_positions as position
      where position.id = p_position_id
    ),
    'STAFF'::public.d3_app_role
  );
$$;

update public.d3_user_access as access
set app_role = public.d3_role_for_position(employee.position_id)
from public.d3_employee as employee
where employee.id = access.employee_id;

-- Upload and C1 projection policies use the new categories. Keep legacy role
-- values in the checks so a partially migrated deployment remains usable.
drop policy if exists "Users read own document uploads" on public.c1_document_uploads;
drop policy if exists "Users create own document uploads" on public.c1_document_uploads;
drop policy if exists "Users update own document uploads" on public.c1_document_uploads;
drop policy if exists "HR users create own document uploads" on public.c1_document_uploads;
drop policy if exists "HR users update own document uploads" on public.c1_document_uploads;
create policy "Users read permitted document uploads" on public.c1_document_uploads
  for select to authenticated using (
    uploader_user_id = auth.uid()
    or exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER'))
  );
create policy "Staff users create own document uploads" on public.c1_document_uploads
  for insert to authenticated with check (
    uploader_user_id = auth.uid()
    and exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'HR'))
  );
create policy "Staff users update own document uploads" on public.c1_document_uploads
  for update to authenticated
  using (uploader_user_id = auth.uid() and exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'HR')))
  with check (uploader_user_id = auth.uid());

drop policy if exists "Users read own c1 documents" on storage.objects;
create policy "Users read permitted c1 documents" on storage.objects
  for select to authenticated using (
    bucket_id = 'c1-document-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or exists (
      select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')
    ))
  );

drop policy if exists "Users read own document errors" on public.c1_document_validation_errors;
drop policy if exists "Users create own document errors" on public.c1_document_validation_errors;
drop policy if exists "HR users create document errors" on public.c1_document_validation_errors;
create policy "Users read permitted document errors" on public.c1_document_validation_errors
  for select to authenticated using (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and (d.uploader_user_id = auth.uid() or exists (
      select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')
    ))
  ));
create policy "Staff users create document errors" on public.c1_document_validation_errors
  for insert to authenticated with check (exists (
    select 1 from public.c1_document_uploads d
    join public.d3_user_access a on a.auth_user_id = auth.uid()
    where d.id = document_id and d.uploader_user_id = auth.uid() and a.app_role::text in ('STAFF', 'HR')
  ));

drop policy if exists "Users read permitted sales staging" on public.c1_company_sales_staging_rows;
drop policy if exists "Users create own sales staging" on public.c1_company_sales_staging_rows;
drop policy if exists "HR users create sales staging" on public.c1_company_sales_staging_rows;
create policy "Users read permitted sales staging" on public.c1_company_sales_staging_rows
  for select to authenticated using (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and (d.uploader_user_id = auth.uid() or exists (
      select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')
    ))
  ));
create policy "Staff users create sales staging" on public.c1_company_sales_staging_rows
  for insert to authenticated with check (exists (
    select 1 from public.c1_document_uploads d
    join public.d3_user_access a on a.auth_user_id = auth.uid()
    where d.id = document_id and d.uploader_user_id = auth.uid() and a.app_role::text in ('STAFF', 'HR')
  ));

drop policy if exists "Users read permitted outstanding staging" on public.c1_outstanding_staging_rows;
drop policy if exists "Users create own outstanding staging" on public.c1_outstanding_staging_rows;
drop policy if exists "HR users create outstanding staging" on public.c1_outstanding_staging_rows;
create policy "Users read permitted outstanding staging" on public.c1_outstanding_staging_rows
  for select to authenticated using (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and (d.uploader_user_id = auth.uid() or exists (
      select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')
    ))
  ));
create policy "Staff users create outstanding staging" on public.c1_outstanding_staging_rows
  for insert to authenticated with check (exists (
    select 1 from public.c1_document_uploads d
    join public.d3_user_access a on a.auth_user_id = auth.uid()
    where d.id = document_id and d.uploader_user_id = auth.uid() and a.app_role::text in ('STAFF', 'HR')
  ));

drop policy if exists "Management can read validated macro metrics" on public.c1_macro_metric;
create policy "Staff and management can read validated macro metrics"
on public.c1_macro_metric for select to authenticated
using (validation_status = 'validated' and exists (
  select 1 from public.d3_user_access
  where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')
));

drop policy if exists "Users read overdue alerts" on public.c1_overdue_alert;
create policy "Users read overdue alerts" on public.c1_overdue_alert
  for select to authenticated using (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')));
drop policy if exists "Users read overdue assignments" on public.c1_assignment;
create policy "Users read overdue assignments" on public.c1_assignment
  for select to authenticated using (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')));
drop policy if exists "Users read overdue MID feed" on public.c1_mid_feed;
create policy "Users read overdue MID feed" on public.c1_mid_feed
  for select to authenticated using (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')));

drop policy if exists "Users create overdue alerts" on public.c1_overdue_alert;
create policy "Users create overdue alerts" on public.c1_overdue_alert
  for insert to authenticated with check (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')));
drop policy if exists "Users update overdue alerts" on public.c1_overdue_alert;
create policy "Users update overdue alerts" on public.c1_overdue_alert
  for update to authenticated
  using (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')))
  with check (exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'MANAGEMENT', 'HR', 'MANAGER')));

create or replace function public.finalize_c1_document_upload(p_document_id uuid, p_row_count integer)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not exists (select 1 from public.d3_user_access where auth_user_id = auth.uid() and app_role::text in ('STAFF', 'HR')) then
   raise exception 'Upload access denied';
 end if;
 perform pg_advisory_xact_lock(610060002);
 update public.c1_document_uploads
 set validation_status = 'validated', processed_at = now(), row_count = p_row_count,
     valid_row_count = p_row_count, invalid_row_count = 0
 where id = p_document_id and uploader_user_id = auth.uid() and validation_status = 'processing';
 if not found then raise exception 'Document cannot be finalized'; end if;
 perform public.refresh_c1_macro_metrics();
end; $$;
revoke all on function public.finalize_c1_document_upload(uuid,integer) from public, anon;
grant execute on function public.finalize_c1_document_upload(uuid,integer) to authenticated;
