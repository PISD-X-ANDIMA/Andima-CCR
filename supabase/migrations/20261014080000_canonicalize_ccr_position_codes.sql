-- CCR uses only canonical positions whose code contains a FAT/COM token. Legacy D1D-* and D1P-*
-- rows remain untouched for compatibility and historical reporting.
begin;

insert into public.d3_departments (code, name)
values
  ('FAT', 'Finance, Accounting & Tax'),
  ('COM', 'Commercial & Customer Success')
on conflict (code) do update
set name = excluded.name;

do $$
declare
  item record;
  department_id uuid;
begin
  for item in
    select * from (values
      ('DIR-FAT', 'Director of Finance, Accounting & Digital Transformation', 'FAT'),
      ('FAT-ACC-MGR', 'Manager of Accounting', 'FAT'),
      ('FAT-BIL', 'Accounting Associate (Billing)', 'FAT'),
      ('FAT-TRS-MGR', 'Cash Manager', 'FAT'),
      ('FAT-TRS-ASC', 'Cash Manager Associate', 'FAT'),
      ('FAT-TAX-MGR', 'Tax Manager', 'FAT'),
      ('FAT-TAX-ASC', 'Tax Associate', 'FAT'),
      ('COM-CS-MGR', 'Manager of Customer Success', 'COM'),
      ('COM-SLS', 'Sales Executive', 'COM'),
      ('COM-SA', 'Sales Administration Associate', 'COM')
    ) as catalog(code, title, department_code)
  loop
    select id into department_id
    from public.d3_departments
    where upper(code) = item.department_code
    order by case when code = item.department_code then 0 else 1 end, id
    limit 1;

    if not exists (
      select 1
      from public.d3_positions position
      join public.d3_departments department on department.id = position.department_id
      where upper(department.code) = item.department_code
        and lower(regexp_replace(trim(position.title), '[[:space:]]+', ' ', 'g')) =
            lower(regexp_replace(trim(item.title), '[[:space:]]+', ' ', 'g'))
        and upper(position.code) ~ ('(^|[-_])' || item.department_code || '([-_]|$)')
    ) then
      insert into public.d3_positions (code, title, department_id)
      values (item.code, item.title, department_id);
    end if;
  end loop;
end $$;

create or replace function public.ccr_canonical_title(p_title text)
returns text
language sql
immutable
as $$
  select case lower(regexp_replace(trim(coalesce(p_title, '')), '[[:space:]]+', ' ', 'g'))
    when 'director of finance, accounting & digital transformation' then 'Director of Finance, Accounting & Digital Transformation'
    when 'director of finance, accounting & tax' then 'Director of Finance, Accounting & Digital Transformation'
    when 'manager of accounting' then 'Manager of Accounting'
    when 'accounting associate (billing)' then 'Accounting Associate (Billing)'
    when 'accounting associate / billing' then 'Accounting Associate (Billing)'
    when 'accounting associates / billing' then 'Accounting Associate (Billing)'
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
language sql
stable
security definer
set search_path = public
as $$
  select canonical.id
  from public.d3_positions source
  join public.d3_positions canonical
    on public.ccr_canonical_title(canonical.title) = public.ccr_canonical_title(source.title)
  join public.d3_departments department
    on department.id = canonical.department_id
  where source.id = p_position_id
    and public.ccr_canonical_title(source.title) is not null
    and upper(department.code) in ('FAT', 'COM')
    and upper(canonical.code) ~ ('(^|[-_])' || upper(department.code) || '([-_]|$)')
  order by
    case when canonical.id = source.id then 0 else 1 end,
    canonical.code,
    canonical.id
  limit 1;
$$;

create or replace function public.ccr_is_canonical_position(p_position_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.d3_positions position
    join public.d3_departments department on department.id = position.department_id
    where position.id = p_position_id
      and position.id = public.ccr_canonical_position_id(position.id)
      and public.ccr_canonical_title(position.title) is not null
      and upper(department.code) in ('FAT', 'COM')
      and upper(position.code) ~ ('(^|[-_])' || upper(department.code) || '([-_]|$)')
  );
$$;

create or replace function public.ccr_role_for_position(p_position_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when position.id = public.ccr_canonical_position_id(position.id)
      and lower(regexp_replace(trim(position.title), '[[:space:]]+', ' ', 'g')) in (
      'director of finance, accounting & digital transformation',
      'manager of accounting',
      'manager of customer success'
    ) then 'MANAGEMENT'
    when position.id = public.ccr_canonical_position_id(position.id)
      and lower(regexp_replace(trim(position.title), '[[:space:]]+', ' ', 'g')) in (
      'accounting associate (billing)',
      'cash manager',
      'cash manager associate',
      'tax manager',
      'tax associate',
      'sales executive',
      'sales administration associate'
    ) then 'STAFF'
    else null
  end
  from public.d3_positions position
  where position.id = p_position_id;
$$;

revoke all on function public.ccr_canonical_title(text) from public, anon, authenticated;
revoke all on function public.ccr_canonical_position_id(uuid) from public, anon, authenticated;
revoke all on function public.ccr_is_canonical_position(uuid) from public, anon, authenticated;
revoke all on function public.ccr_role_for_position(uuid) from public, anon, authenticated;
grant execute on function public.ccr_canonical_position_id(uuid) to service_role;
grant execute on function public.ccr_is_canonical_position(uuid) to service_role;
grant execute on function public.ccr_role_for_position(uuid) to service_role;

-- Re-evaluate existing B2 profiles through the canonical CCR mapping. No
-- master rows are deleted or moved, so legacy D1P/D1D history remains intact.
update public.b2_register
set resolved_role = public.ccr_role_for_position(position_id),
    registration_status = case
      when public.ccr_role_for_position(position_id) is null then 'REJECTED'
      else 'PROVISIONED'
    end,
    is_active = public.ccr_role_for_position(position_id) is not null,
    approved_at = case
      when public.ccr_role_for_position(position_id) is null then approved_at
      else coalesce(approved_at, created_at)
    end
where position_id is not null;

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
     )
     or not exists (select 1 from public.d3_departments where id = p_department_id) then
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

commit;
