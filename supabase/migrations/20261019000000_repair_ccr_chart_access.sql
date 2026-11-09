-- Repair the provisioned CCR profiles used by C1 chart authorization.
-- This migration is intentionally strict: it never creates Auth users and
-- aborts the transaction when an expected account or canonical position is
-- missing or ambiguous.

begin;

do $$
declare
  item record;
  v_auth_user_id uuid;
  auth_count integer;
  profile_count integer;
  position_count integer;
  v_position_id uuid;
  v_department_id uuid;
  existing_auth_link_count integer;
begin
  for item in
    select * from (values
      ('stevanusimanuel@andima.co.id', 'CCR-003', 'DIR-FAT', 'MANAGEMENT'),
      ('jonathanindrawan@andima.co.id', 'CCR-004', 'FAT-ACC-MGR', 'MANAGEMENT'),
      ('diazbara@andima.co.id', 'CCR-005', 'COM-CS-MGR', 'MANAGEMENT'),
      ('jesichan@andima.co.id', 'CCR-006', 'FAT-BIL', 'STAFF'),
      ('aldosapan@andima.co.id', 'CCR-007', 'FAT-TRS-MGR', 'STAFF'),
      ('michaeljackson@andima.co.id', 'CCR-008', 'FAT-TAX-MGR', 'STAFF'),
      ('taylorswift@andima.co.id', 'CCR-009', 'FAT-TAX-ASC', 'STAFF'),
      ('keanureeves@andima.co.id', 'CCR-010', 'COM-SLS', 'STAFF'),
      ('emmawatson@andima.co.id', 'CCR-011', 'COM-SA', 'STAFF'),
      ('tomhanks@andima.co.id', 'CCR-012', 'FAT-TRS-ASC', 'STAFF')
    ) as target(email, employee_id, position_code, expected_role)
  loop
    select count(*) into auth_count
    from auth.users
    where lower(email) = lower(item.email);

    if auth_count <> 1 then
      raise exception 'CCR access repair expected exactly one Auth user for %, found %', item.email, auth_count;
    end if;

    select id into v_auth_user_id
    from auth.users
    where lower(email) = lower(item.email);

    select count(*) into profile_count
    from public.b2_register
    where lower(email) = lower(item.email)
       or employee_id = item.employee_id;

    if profile_count <> 1 then
      raise exception 'CCR access repair expected exactly one b2_register profile for % / %, found %', item.email, item.employee_id, profile_count;
    end if;

    select count(*) into position_count
    from public.d3_positions position
    where upper(position.code) = upper(item.position_code)
      and public.ccr_role_for_position(position.id) = item.expected_role;

    if position_count <> 1 then
      raise exception 'CCR access repair expected exactly one canonical position % with role %, found %', item.position_code, item.expected_role, position_count;
    end if;

    select position.id, position.department_id
      into v_position_id, v_department_id
    from public.d3_positions position
    where upper(position.code) = upper(item.position_code)
      and public.ccr_role_for_position(position.id) = item.expected_role;

    select count(*) into existing_auth_link_count
    from public.b2_register
    where b2_register.auth_user_id = v_auth_user_id
      and not (lower(email) = lower(item.email) or employee_id = item.employee_id);

    if existing_auth_link_count <> 0 then
      raise exception 'CCR access repair found Auth user % linked to another b2_register profile', v_auth_user_id;
    end if;

    update public.b2_register
    set auth_user_id = v_auth_user_id,
        employee_id = item.employee_id,
        email = lower(item.email),
        position_id = v_position_id,
        departement_id = v_department_id,
        resolved_role = item.expected_role,
        registration_status = 'PROVISIONED',
        is_active = true,
        approved_at = coalesce(approved_at, now())
    where lower(email) = lower(item.email)
       or employee_id = item.employee_id;
  end loop;
end $$;

commit;
