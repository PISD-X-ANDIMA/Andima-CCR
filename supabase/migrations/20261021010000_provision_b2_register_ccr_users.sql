DO $$
declare
  item record;
  v_auth_user record;
  v_position_id uuid;
  v_emp_id uuid;
begin
  -- 1. Ensure canonical position DIR-FAT exists
  insert into public.d3_positions (id, code, title, department_id)
  values (
    '69530b28-b35f-4559-afe5-72c0dde0110d',
    'DIR-FAT',
    'Director of Finance, Accounting & Digital Transformation',
    '1653db5f-2b64-418f-b28b-68cb7b9dae8e'
  )
  on conflict (id) do update set
    code = excluded.code,
    title = excluded.title,
    department_id = excluded.department_id;

  -- 2. Disable immutable trigger during administrative provisioning
  alter table public.b2_register disable trigger d3_reject_b2_employee_id_change;

  -- 3. Loop through target accounts
  for item in
    select * from (values
      ('stevanusimanuel@andima.co.id', 'Stevanus Imanuel', 'CCR-003', 'DIR-FAT', '1653db5f-2b64-418f-b28b-68cb7b9dae8e'::uuid, 'MANAGEMENT', 'MANAGER'::public.d3_app_role, '07635257352'),
      ('jonathanindrawan@andima.co.id', 'Jonathan Indrawan', 'CCR-004', 'FAT-ACC-MGR', '1653db5f-2b64-418f-b28b-68cb7b9dae8e'::uuid, 'MANAGEMENT', 'MANAGER'::public.d3_app_role, '0872635166'),
      ('diazbara@andima.co.id', 'Diaz Bara', 'CCR-005', 'COM-CS-MGR', '97ac5d35-5da2-4f5d-9d36-78500f403cc7'::uuid, 'MANAGEMENT', 'MANAGER'::public.d3_app_role, '628111000003'),
      ('jesichan@andima.co.id', 'Jesicha Novrani', 'CCR-006', 'FAT-BIL', '1653db5f-2b64-418f-b28b-68cb7b9dae8e'::uuid, 'STAFF', 'HR'::public.d3_app_role, '0896352721'),
      ('aldosapan@andima.co.id', 'Aldo Sapan', 'CCR-007', 'FAT-TRS-MGR', '1653db5f-2b64-418f-b28b-68cb7b9dae8e'::uuid, 'STAFF', 'HR'::public.d3_app_role, '628111000005'),
      ('michaeljackson@andima.co.id', 'Michael Jackson', 'CCR-008', 'FAT-TAX-MGR', '1653db5f-2b64-418f-b28b-68cb7b9dae8e'::uuid, 'STAFF', 'HR'::public.d3_app_role, '628111000006'),
      ('taylorswift@andima.co.id', 'Taylor Swift', 'CCR-009', 'FAT-TAX-ASC-002', '1653db5f-2b64-418f-b28b-68cb7b9dae8e'::uuid, 'STAFF', 'HR'::public.d3_app_role, '628111000007'),
      ('keanureeves@andima.co.id', 'Keanu Reeves', 'CCR-010', 'COM-SLS-003', '97ac5d35-5da2-4f5d-9d36-78500f403cc7'::uuid, 'STAFF', 'HR'::public.d3_app_role, '628111000008'),
      ('emmawatson@andima.co.id', 'Emma Watson', 'CCR-011', 'COM-SA', '97ac5d35-5da2-4f5d-9d36-78500f403cc7'::uuid, 'STAFF', 'HR'::public.d3_app_role, '628111000009'),
      ('tomhanks@andima.co.id', 'Tom Hanks', 'CCR-012', 'FAT-TRS-ASC', '1653db5f-2b64-418f-b28b-68cb7b9dae8e'::uuid, 'STAFF', 'HR'::public.d3_app_role, '628111000010')
    ) as t(email, full_name, employee_id, position_code, department_id, ccr_role, d3_role, phone)
  loop
    -- Find Auth User
    select id into v_auth_user
    from auth.users
    where lower(email) = lower(item.email);

    if v_auth_user.id is null then
      raise exception 'Auth user not found for email %', item.email;
    end if;

    -- Find Position ID
    select id into v_position_id
    from public.d3_positions
    where upper(code) = upper(item.position_code)
    limit 1;

    if v_position_id is null then
      raise exception 'Position not found for code %', item.position_code;
    end if;

    -- Upsert b2_register
    if exists (select 1 from public.b2_register where id = v_auth_user.id or lower(email) = lower(item.email)) then
      update public.b2_register
      set auth_user_id = v_auth_user.id,
          employee_id = item.employee_id,
          full_name = item.full_name,
          email = lower(item.email),
          phone = coalesce(item.phone, phone),
          position_id = v_position_id,
          departement_id = item.department_id,
          password = '@CCR12345a',
          registration_status = 'PROVISIONED',
          resolved_role = item.ccr_role,
          is_active = true,
          approved_at = coalesce(approved_at, now())
      where id = v_auth_user.id or lower(email) = lower(item.email);
    else
      insert into public.b2_register (
        id, auth_user_id, employee_id, full_name, email, phone,
        employment_status, position_id, departement_id, password,
        registration_status, resolved_role, approved_at, is_active
      ) values (
        v_auth_user.id, v_auth_user.id, item.employee_id, item.full_name, lower(item.email), item.phone,
        'permanent', v_position_id, item.department_id, '@CCR12345a',
        'PROVISIONED', item.ccr_role, now(), true
      );
    end if;

    -- Upsert d3_employee
    select id into v_emp_id
    from public.d3_employee
    where employee_id = item.employee_id or lower(email) = lower(item.email)
    limit 1;

    if v_emp_id is not null then
      update public.d3_employee
      set employee_id = item.employee_id,
          full_name = item.full_name,
          email = lower(item.email),
          position_id = v_position_id,
          department_id = item.department_id,
          employment_status = 'PERMANENT'
      where id = v_emp_id;
    else
      insert into public.d3_employee (
        employee_id, full_name, email, phone, join_date,
        employment_status, position_id, department_id, work_location
      ) values (
        item.employee_id, item.full_name, lower(item.email), item.phone, current_date,
        'PERMANENT', v_position_id, item.department_id, 'HQ'
      ) returning id into v_emp_id;
    end if;

    -- Upsert d3_user_access
    insert into public.d3_user_access (auth_user_id, employee_id, app_role)
    values (v_auth_user.id, v_emp_id, item.d3_role)
    on conflict (auth_user_id) do update set
      employee_id = excluded.employee_id,
      app_role = excluded.app_role,
      updated_at = now();

  end loop;

  -- Re-enable trigger
  alter table public.b2_register enable trigger d3_reject_b2_employee_id_change;
end $$;
