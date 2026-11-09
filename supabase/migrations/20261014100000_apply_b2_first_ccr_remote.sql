-- Remote-safe CCR authorization layer. This migration intentionally preserves
-- all legacy D1D/D1P master rows and uses b2_register as the authorization source.

begin;

alter table public.c1_document_validation_errors
  add column if not exists severity text not null default 'ERROR';
alter table public.c1_document_validation_errors
  drop constraint if exists c1_document_validation_errors_severity_check;
alter table public.c1_document_validation_errors
  add constraint c1_document_validation_errors_severity_check
  check (severity in ('ERROR', 'WARNING'));

alter table public.b2_register
  add column if not exists auth_user_id uuid,
  add column if not exists registration_status text not null default 'PROVISIONED',
  add column if not exists resolved_role text,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists is_active boolean not null default true;

create or replace function public.ccr_canonical_title(p_title text)
returns text
language sql immutable
as $$
  select case lower(regexp_replace(trim(coalesce(p_title, '')), '[[:space:]]+', ' ', 'g'))
    when 'director of finance, accounting & digital transformation' then 'Director of Finance, Accounting & Digital Transformation'
    when 'director of finance, accounting & tax' then 'Director of Finance, Accounting & Digital Transformation'
    when 'manager of accounting' then 'Manager of Accounting'
    when 'accounting associate (billing)' then 'Accounting Associate (Billing)'
    when 'accounting associate / billing' then 'Accounting Associate (Billing)'
    when 'accounting associates / billing' then 'Accounting Associate (Billing)'
    when 'accounting associate 1 (billing)' then 'Accounting Associate (Billing)'
    when 'accounting associate 2 (billing)' then 'Accounting Associate (Billing)'
    when 'cash management' then 'Cash Manager'
    when 'cash manager' then 'Cash Manager'
    when 'cash manager associate' then 'Cash Manager Associate'
    when 'tax manager' then 'Tax Manager'
    when 'tax associate' then 'Tax Associate'
    when 'tax associates' then 'Tax Associate'
    when 'manager of customer success' then 'Manager of Customer Success'
    when 'sales executive' then 'Sales Executive'
    when 'sales executives' then 'Sales Executive'
    when 'sales administration associate' then 'Sales Administration Associate'
    when 'sales administration associates' then 'Sales Administration Associate'
    when 'sales administration associate team' then 'Sales Administration Associate'
    else null
  end;
$$;

create or replace function public.ccr_canonical_position_id(p_position_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select candidate.id
  from public.d3_positions source
  join public.d3_positions candidate
    on public.ccr_canonical_title(candidate.title) = public.ccr_canonical_title(source.title)
  join public.d3_departments department on department.id = candidate.department_id
  where source.id = p_position_id
    and public.ccr_canonical_title(source.title) is not null
    and upper(department.code) in ('FAT', 'COM')
    and upper(candidate.code) ~ ('(^|[-_])' || upper(department.code) || '([-_]|$)')
  order by case when candidate.id = source.id then 0 else 1 end, candidate.code, candidate.id
  limit 1;
$$;

create or replace function public.ccr_role_for_position(p_position_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when position.id = public.ccr_canonical_position_id(position.id)
      and public.ccr_canonical_title(position.title) in (
        'Director of Finance, Accounting & Digital Transformation',
        'Manager of Accounting',
        'Manager of Customer Success'
      ) then 'MANAGEMENT'
    when position.id = public.ccr_canonical_position_id(position.id)
      and public.ccr_canonical_title(position.title) in (
        'Accounting Associate (Billing)',
        'Cash Manager',
        'Cash Manager Associate',
        'Tax Manager',
        'Tax Associate',
        'Sales Executive',
        'Sales Administration Associate'
      ) then 'STAFF'
    else null
  end
  from public.d3_positions position
  where position.id = p_position_id;
$$;

create or replace function public.ccr_is_canonical_position(p_position_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.ccr_role_for_position(p_position_id) is not null;
$$;

revoke all on function public.ccr_canonical_title(text) from public, anon, authenticated;
revoke all on function public.ccr_canonical_position_id(uuid) from public, anon, authenticated;
revoke all on function public.ccr_role_for_position(uuid) from public, anon, authenticated;
revoke all on function public.ccr_is_canonical_position(uuid) from public, anon, authenticated;
grant execute on function public.ccr_canonical_position_id(uuid) to service_role;
grant execute on function public.ccr_role_for_position(uuid) to service_role;
grant execute on function public.ccr_is_canonical_position(uuid) to service_role;

update public.b2_register b
set auth_user_id = coalesce(
      b.auth_user_id,
      (select u.id from auth.users u where u.id = b.id limit 1),
      (select u.id from auth.users u where lower(u.email) = lower(b.email) limit 1)
    )
where b.auth_user_id is null;

create unique index if not exists b2_register_auth_user_id_key
  on public.b2_register(auth_user_id)
  where auth_user_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'b2_register_auth_user_id_fkey') then
    alter table public.b2_register
      add constraint b2_register_auth_user_id_fkey
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

update public.b2_register b
set resolved_role = public.ccr_role_for_position(b.position_id),
    registration_status = case
      when public.ccr_role_for_position(b.position_id) is not null and b.auth_user_id is not null then 'PROVISIONED'
      else 'REJECTED'
    end,
    is_active = public.ccr_role_for_position(b.position_id) is not null and b.auth_user_id is not null,
    approved_at = case
      when public.ccr_role_for_position(b.position_id) is not null then coalesce(b.approved_at, b.created_at)
      else b.approved_at
    end;

create or replace function public.ccr_current_role()
returns text language sql stable security definer set search_path = public
as $$
  select case when registration_status in ('APPROVED', 'PROVISIONED') and is_active
    then resolved_role else null end
  from public.b2_register
  where auth_user_id = auth.uid() or id = auth.uid()
  limit 1;
$$;

create or replace function public.ccr_current_employee_id()
returns text language sql stable security definer set search_path = public
as $$
  select employee_id
  from public.b2_register
  where (auth_user_id = auth.uid() or id = auth.uid())
    and registration_status in ('APPROVED', 'PROVISIONED')
    and is_active = true
  limit 1;
$$;

create or replace function public.d3_current_role()
returns public.d3_app_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select case public.ccr_current_role()
    when 'STAFF' then 'STAFF'::public.d3_app_role
    when 'MANAGEMENT' then 'MANAGEMENT'::public.d3_app_role
    else 'EMPLOYEE'::public.d3_app_role
  end;
$$;

create or replace function public.d3_role_for_position(p_position_id uuid)
returns public.d3_app_role
language sql stable security definer set search_path = public
as $$
  select coalesce(public.ccr_role_for_position(p_position_id)::public.d3_app_role, 'EMPLOYEE'::public.d3_app_role);
$$;

revoke all on function public.ccr_current_role() from public, anon;
revoke all on function public.ccr_current_employee_id() from public, anon;
grant execute on function public.ccr_current_role() to authenticated, service_role;
grant execute on function public.ccr_current_employee_id() to authenticated, service_role;
grant execute on function public.d3_current_role() to authenticated, service_role;
grant execute on function public.d3_role_for_position(uuid) to service_role;

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
  if not exists (
    select 1 from public.d3_positions
    where id = p_position_id and department_id = p_department_id
  ) or not exists (select 1 from public.d3_departments where id = p_department_id) then
    raise exception 'Invalid registration reference';
  end if;
  if not public.ccr_is_canonical_position(p_position_id) then
    raise exception 'Position is not a canonical CCR position';
  end if;
  v_role := public.ccr_role_for_position(p_position_id);
  if v_role is null then raise exception 'Position is not eligible for CCR'; end if;
  if exists (select 1 from public.b2_register where lower(email) = lower(p_email))
     or exists (select 1 from public.d3_employee where lower(email) = lower(p_email)) then
    raise exception 'Email already registered';
  end if;
  select coalesce(max(n), 0) + 1 into v_number
  from (
    select substring(employee_id from 5)::integer as n from public.d3_employee where employee_id ~ '^CCR-[0-9]+$'
    union all
    select substring(employee_id from 5)::integer as n from public.b2_register where employee_id ~ '^CCR-[0-9]+$'
  ) ids;
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

create or replace function public.rollback_app_registration(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_employee_id text;
begin
  perform pg_advisory_xact_lock(610060001);
  select employee_id into v_employee_id from public.b2_register where auth_user_id = p_user_id or id = p_user_id;
  delete from public.d3_user_access where auth_user_id = p_user_id;
  delete from public.b2_register where auth_user_id = p_user_id or id = p_user_id;
  if v_employee_id is not null then delete from public.d3_employee where employee_id = v_employee_id; end if;
end; $$;

revoke all on function public.provision_app_registration(uuid,text,text,text,text,uuid,uuid) from public, anon, authenticated;
revoke all on function public.rollback_app_registration(uuid) from public, anon, authenticated;
grant execute on function public.provision_app_registration(uuid,text,text,text,text,uuid,uuid) to service_role;
grant execute on function public.rollback_app_registration(uuid) to service_role;

drop policy if exists "Allow anon insert" on public.b2_register;
drop policy if exists "Allow anon select" on public.b2_register;
drop policy if exists "Users can read own profile" on public.b2_register;
drop policy if exists "Allow update access on b2_register" on public.b2_register;
drop policy if exists "B2 users read own registration" on public.b2_register;
create policy "B2 users read own registration" on public.b2_register
  for select to authenticated using (auth_user_id = auth.uid() or id = auth.uid());
revoke all on public.b2_register from anon;
grant select on public.b2_register to authenticated;

-- Replace legacy C1 policies with B2-first policies. API routes use the server
-- client, while these policies protect any authenticated client access.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'c1_document_uploads','c1_document_validation_errors',
      'c1_company_sales_staging_rows','c1_outstanding_staging_rows',
      'c1_macro_metric','c1_overdue_alert','c1_assignment','c1_mid_feed'
    )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "CCR users read document uploads" on public.c1_document_uploads
  for select to authenticated using (uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF','MANAGEMENT'));
create policy "Staff users create document uploads" on public.c1_document_uploads
  for insert to authenticated with check (uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF');
create policy "Staff users update document uploads" on public.c1_document_uploads
  for update to authenticated using (uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF') with check (uploader_user_id = auth.uid());

create policy "CCR users read document errors" on public.c1_document_validation_errors
  for select to authenticated using (exists (select 1 from public.c1_document_uploads d where d.id = document_id and (d.uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF','MANAGEMENT'))));
create policy "Staff users create document errors" on public.c1_document_validation_errors
  for insert to authenticated with check (exists (select 1 from public.c1_document_uploads d where d.id = document_id and d.uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'));

create policy "CCR users read sales staging" on public.c1_company_sales_staging_rows
  for select to authenticated using (exists (select 1 from public.c1_document_uploads d where d.id = document_id and (d.uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF','MANAGEMENT'))));
create policy "Staff users create sales staging" on public.c1_company_sales_staging_rows
  for insert to authenticated with check (exists (select 1 from public.c1_document_uploads d where d.id = document_id and d.uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'));
create policy "CCR users read outstanding staging" on public.c1_outstanding_staging_rows
  for select to authenticated using (exists (select 1 from public.c1_document_uploads d where d.id = document_id and (d.uploader_user_id = auth.uid() or public.ccr_current_role() in ('STAFF','MANAGEMENT'))));
create policy "Staff users create outstanding staging" on public.c1_outstanding_staging_rows
  for insert to authenticated with check (exists (select 1 from public.c1_document_uploads d where d.id = document_id and d.uploader_user_id = auth.uid() and public.ccr_current_role() = 'STAFF'));

create policy "CCR users read macro metrics" on public.c1_macro_metric
  for select to authenticated using (validation_status = 'validated' and public.ccr_current_role() in ('STAFF','MANAGEMENT'));
create policy "CCR users read overdue alerts" on public.c1_overdue_alert
  for select to authenticated using (public.ccr_current_role() in ('STAFF','MANAGEMENT'));
create policy "Management writes overdue alerts" on public.c1_overdue_alert
  for all to authenticated using (public.ccr_current_role() = 'MANAGEMENT') with check (public.ccr_current_role() = 'MANAGEMENT');
create policy "CCR users read assignments" on public.c1_assignment
  for select to authenticated using (public.ccr_current_role() = 'MANAGEMENT' or assigned_to = public.ccr_current_employee_id());
create policy "Management reads MID feed" on public.c1_mid_feed
  for select to authenticated using (public.ccr_current_role() = 'MANAGEMENT');

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

commit;
