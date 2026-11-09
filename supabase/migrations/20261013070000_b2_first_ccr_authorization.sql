-- B2 Register is the application authorization source for CCR.
alter table public.b2_register
  add column if not exists auth_user_id uuid,
  add column if not exists registration_status text not null default 'PROVISIONED',
  add column if not exists resolved_role text,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists is_active boolean not null default true;

update public.b2_register
set auth_user_id = id
where auth_user_id is null
  and exists (select 1 from auth.users u where u.id = public.b2_register.id);

create unique index if not exists b2_register_auth_user_id_key
  on public.b2_register(auth_user_id)
  where auth_user_id is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'b2_register_auth_user_id_fkey') then
    alter table public.b2_register add constraint b2_register_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.b2_register
  drop constraint if exists b2_register_registration_status_check,
  drop constraint if exists b2_register_resolved_role_check;
alter table public.b2_register
  add constraint b2_register_registration_status_check
    check (registration_status in ('PENDING', 'APPROVED', 'PROVISIONED', 'REJECTED')),
  add constraint b2_register_resolved_role_check
    check (resolved_role is null or resolved_role in ('STAFF', 'MANAGEMENT'));

create or replace function public.ccr_role_for_position(p_position_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when lower(regexp_replace(trim(position.title), '[[:space:]]+', ' ', 'g')) in (
      'director of finance, accounting & digital transformation',
      'manager of accounting',
      'manager of customer success'
    ) then 'MANAGEMENT'
    when lower(regexp_replace(trim(position.title), '[[:space:]]+', ' ', 'g')) in (
      'accounting associate (billing)', 'accounting associate / billing',
      'accounting associates / billing', 'cash management', 'cash manager',
      'cash manager associate', 'tax manager', 'tax associate', 'tax associates',
      'sales executive', 'sales executives', 'sales administration associate',
      'sales administration associates', 'sales administration associate team'
    ) then 'STAFF'
    else null
  end
  from public.d3_positions position
  where position.id = p_position_id;
$$;

revoke all on function public.ccr_role_for_position(uuid) from public, anon;
grant execute on function public.ccr_role_for_position(uuid) to service_role;

update public.b2_register b
set resolved_role = public.ccr_role_for_position(b.position_id),
    registration_status = case when public.ccr_role_for_position(b.position_id) is null then 'REJECTED' else 'PROVISIONED' end,
    is_active = public.ccr_role_for_position(b.position_id) is not null,
    approved_at = coalesce(b.approved_at, b.created_at)
where b.resolved_role is null or b.registration_status is distinct from 'PROVISIONED';

create or replace function public.provision_app_registration(
  p_user_id uuid, p_full_name text, p_email text, p_phone text,
  p_status text, p_position_id uuid, p_department_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_employee_id text;
  v_employee uuid;
  v_number integer;
begin
  perform pg_advisory_xact_lock(610060001);
  if not exists (select 1 from auth.users where id = p_user_id and lower(email) = lower(p_email)) then
    raise exception 'Auth user mismatch';
  end if;
  if not exists (select 1 from public.d3_positions where id = p_position_id and department_id = p_department_id)
     or not exists (select 1 from public.d3_departments where id = p_department_id) then
    raise exception 'Invalid registration reference';
  end if;
  v_role := public.ccr_role_for_position(p_position_id);
  if v_role is null then raise exception 'Position is not eligible for CCR'; end if;
  if exists (select 1 from public.b2_register where lower(email) = lower(p_email))
     or exists (select 1 from public.d3_employee where lower(email) = lower(p_email)) then
    raise exception 'Email already registered';
  end if;
  select coalesce(max(substring(employee_id from 5)::integer), 0) + 1 into v_number
  from public.d3_employee where employee_id ~ '^CCR-[0-9]+$';
  v_employee_id := 'CCR-' || lpad(v_number::text, 3, '0');
  insert into public.b2_register (
    id, auth_user_id, employee_id, full_name, email, phone, employment_status,
    position_id, departement_id, registration_status, resolved_role, approved_at, is_active
  ) values (
    p_user_id, p_user_id, v_employee_id, p_full_name, lower(p_email), p_phone,
    upper(p_status), p_position_id, p_department_id, 'PROVISIONED', v_role, now(), true
  );
  insert into public.d3_employee (
    employee_id, full_name, email, phone, join_date, employment_status,
    position_id, department_id, work_location
  ) values (
    v_employee_id, p_full_name, lower(p_email), p_phone, current_date,
    upper(p_status), p_position_id, p_department_id, 'HQ'
  ) returning id into v_employee;
  return jsonb_build_object('employee_id', v_employee_id, 'app_role', v_role, 'employee_uuid', v_employee);
end; $$;

revoke all on function public.provision_app_registration(uuid,text,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.provision_app_registration(uuid,text,text,text,text,uuid,uuid) to service_role;

create or replace function public.rollback_app_registration(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_employee_id text;
begin
  perform pg_advisory_xact_lock(610060001);
  select employee_id into v_employee_id
  from public.b2_register
  where auth_user_id = p_user_id or id = p_user_id;
  delete from public.d3_user_access where auth_user_id = p_user_id;
  delete from public.b2_register where auth_user_id = p_user_id or id = p_user_id;
  if v_employee_id is not null then
    delete from public.d3_employee where employee_id = v_employee_id;
  end if;
end; $$;

revoke all on function public.rollback_app_registration(uuid) from public, anon, authenticated;
grant execute on function public.rollback_app_registration(uuid) to service_role;

drop policy if exists "Allow anon insert" on public.b2_register;
drop policy if exists "Allow anon select" on public.b2_register;
drop policy if exists "B2 users read own registration" on public.b2_register;
create policy "B2 users read own registration" on public.b2_register
  for select to authenticated using (auth_user_id = auth.uid() or id = auth.uid());
revoke all on public.b2_register from anon;
grant select on public.b2_register to authenticated;

create or replace function public.ccr_current_role()
returns text language sql stable security definer set search_path = public
as $$
  select resolved_role from public.b2_register
  where auth_user_id = auth.uid() or id = auth.uid()
  limit 1;
$$;

create or replace function public.ccr_current_employee_id()
returns text language sql stable security definer set search_path = public
as $$
  select employee_id from public.b2_register
  where (auth_user_id = auth.uid() or id = auth.uid())
    and registration_status in ('APPROVED', 'PROVISIONED')
    and is_active = true
  limit 1;
$$;

revoke all on function public.ccr_current_role() from public, anon;
revoke all on function public.ccr_current_employee_id() from public, anon;
grant execute on function public.ccr_current_role() to authenticated, service_role;
grant execute on function public.ccr_current_employee_id() to authenticated, service_role;

drop policy if exists "Users read overdue alerts" on public.c1_overdue_alert;
create policy "CCR users read overdue alerts" on public.c1_overdue_alert
  for select to authenticated using (public.ccr_current_role() in ('STAFF', 'MANAGEMENT'));
drop policy if exists "Users create overdue alerts" on public.c1_overdue_alert;
create policy "Management create overdue alerts" on public.c1_overdue_alert
  for insert to authenticated with check (public.ccr_current_role() = 'MANAGEMENT');
drop policy if exists "Users update overdue alerts" on public.c1_overdue_alert;
create policy "Management update overdue alerts" on public.c1_overdue_alert
  for update to authenticated using (public.ccr_current_role() = 'MANAGEMENT')
  with check (public.ccr_current_role() = 'MANAGEMENT');

drop policy if exists "Users read overdue assignments" on public.c1_assignment;
create policy "CCR users read overdue assignments" on public.c1_assignment
  for select to authenticated using (
    public.ccr_current_role() = 'MANAGEMENT'
    or assigned_to = public.ccr_current_employee_id()
  );

drop policy if exists "Users read overdue MID feed" on public.c1_mid_feed;
create policy "Management read overdue MID feed" on public.c1_mid_feed
  for select to authenticated using (public.ccr_current_role() = 'MANAGEMENT');

drop policy if exists "Users read permitted document uploads" on public.c1_document_uploads;
create policy "CCR users read permitted document uploads" on public.c1_document_uploads
  for select to authenticated using (
    uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF', 'MANAGEMENT')
  );

drop policy if exists "Staff users create own document uploads" on public.c1_document_uploads;
create policy "Staff users create own document uploads" on public.c1_document_uploads
  for insert to authenticated with check (
    uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'
  );
drop policy if exists "Staff users update own document uploads" on public.c1_document_uploads;
create policy "Staff users update own document uploads" on public.c1_document_uploads
  for update to authenticated using (
    uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'
  ) with check (uploader_user_id = auth.uid());

drop policy if exists "Users read permitted sales staging" on public.c1_company_sales_staging_rows;
create policy "CCR users read permitted sales staging" on public.c1_company_sales_staging_rows
  for select to authenticated using (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and (d.uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF', 'MANAGEMENT'))
  ));
drop policy if exists "Users read permitted outstanding staging" on public.c1_outstanding_staging_rows;
create policy "CCR users read permitted outstanding staging" on public.c1_outstanding_staging_rows
  for select to authenticated using (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and (d.uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF', 'MANAGEMENT'))
  ));
drop policy if exists "Staff users create sales staging" on public.c1_company_sales_staging_rows;
drop policy if exists "Users create own sales staging" on public.c1_company_sales_staging_rows;
create policy "Staff users create sales staging" on public.c1_company_sales_staging_rows
  for insert to authenticated with check (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and d.uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'
  ));
drop policy if exists "Staff users create outstanding staging" on public.c1_outstanding_staging_rows;
drop policy if exists "Users create own outstanding staging" on public.c1_outstanding_staging_rows;
create policy "Staff users create outstanding staging" on public.c1_outstanding_staging_rows
  for insert to authenticated with check (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and d.uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'
  ));

drop policy if exists "Users read permitted document errors" on public.c1_document_validation_errors;
create policy "CCR users read permitted document errors" on public.c1_document_validation_errors
  for select to authenticated using (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and (d.uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF', 'MANAGEMENT'))
  ));
drop policy if exists "Staff users create document errors" on public.c1_document_validation_errors;
create policy "Staff users create document errors" on public.c1_document_validation_errors
  for insert to authenticated with check (exists (
    select 1 from public.c1_document_uploads d
    where d.id = document_id and d.uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'
  ));

drop policy if exists "Users read permitted c1 documents" on storage.objects;
create policy "CCR users read permitted c1 documents" on storage.objects
  for select to authenticated using (
    bucket_id = 'c1-document-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.ccr_current_role() in ('STAFF', 'MANAGEMENT'))
  );
drop policy if exists "Users upload own c1 documents" on storage.objects;
create policy "Staff users upload own c1 documents" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'c1-document-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.ccr_current_role() = 'STAFF'
  );

drop policy if exists "Staff and management can read validated macro metrics" on public.c1_macro_metric;
create policy "CCR users read validated macro metrics" on public.c1_macro_metric
  for select to authenticated using (validation_status = 'validated' and public.ccr_current_role() in ('STAFF', 'MANAGEMENT'));

create or replace function public.finalize_c1_document_upload(p_document_id uuid, p_row_count integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.ccr_current_role() <> 'STAFF' then raise exception 'Upload access denied'; end if;
  perform pg_advisory_xact_lock(610060002);
  update public.c1_document_uploads
  set validation_status = 'validated', processed_at = now(), row_count = p_row_count,
      valid_row_count = p_row_count, invalid_row_count = 0
  where id = p_document_id and uploader_user_id = auth.uid() and validation_status = 'processing';
  if not found then raise exception 'Document cannot be finalized'; end if;
  perform public.refresh_c1_macro_metrics();
end; $$;

revoke all on function public.finalize_c1_document_upload(uuid, integer) from public, anon;
grant execute on function public.finalize_c1_document_upload(uuid, integer) to authenticated, service_role;
