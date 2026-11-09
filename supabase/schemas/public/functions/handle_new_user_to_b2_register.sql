CREATE OR REPLACE FUNCTION public.handle_new_user_to_b2_register()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
declare
  target_position_id uuid;
  target_dept_id uuid;
  user_pos_id text;
  user_dept_id text;
  generated_emp_id text;
begin
  -- 1. Ambil position_id & department_id dari metadata register
  user_pos_id := new.raw_user_meta_data->>'position_id';
  user_dept_id := new.raw_user_meta_data->>'department_id';

  if user_pos_id is not null and user_pos_id != '' then
    target_position_id := user_pos_id::uuid;
  end if;

  if user_dept_id is not null and user_dept_id != '' then
    target_dept_id := user_dept_id::uuid;
  end if;

  -- Fallback jika posisi/departemen kosong
  if target_position_id is null then
    select id into target_position_id from public.d3_positions limit 1;
  end if;

  if target_dept_id is null then
    select id into target_dept_id from public.d3_departments limit 1;
  end if;

  generated_emp_id := 'EMP-' || substring(new.id::text, 1, 6);

  -- 2. Insert ke b2_register
  insert into public.b2_register (
    employee_id, full_name, email, position_id
  )
  values (
    generated_emp_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    target_position_id
  );

  -- 3. Insert ke d3_employee agar LANGSUNG MUNCUL di view_employee_360!
  insert into public.d3_employee (
    id, employee_id, full_name, email, position_id, department_id, join_date
  )
  values (
    new.id,
    generated_emp_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    target_position_id,
    target_dept_id,
    current_date
  )
  on conflict (id) do update set
    position_id = excluded.position_id,
    department_id = excluded.department_id;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."handle_new_user_to_b2_register"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."handle_new_user_to_b2_register"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user_to_b2_register"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."handle_new_user_to_b2_register"() FROM "anon", "authenticated", "service_role";
