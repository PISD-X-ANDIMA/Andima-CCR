CREATE OR REPLACE FUNCTION public.d3_audit_employee_profile()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_actor_employee_id uuid;
  v_action text;
  v_employee_record_id uuid;
  v_changed_fields text[] := '{}'::text[];
begin
  select dua.employee_id
    into v_actor_employee_id
  from public.d3_user_access dua
  where dua.auth_user_id = auth.uid()
  limit 1;

  if tg_op = 'INSERT' then
    v_action := 'CREATE';
    v_employee_record_id := new.id;
    v_changed_fields := array[
      'employee_id','full_name','email','phone','identity_type','identity_number',
      'join_date','employment_status','position_id','department_id','work_location','avatar_url'
    ];
  elsif tg_op = 'UPDATE' then
    v_employee_record_id := new.id;
    if old.employment_status is distinct from new.employment_status then
      v_action := 'STATUS_CHANGE';
    else
      v_action := 'UPDATE';
    end if;

    select coalesce(array_agg(k order by k), '{}'::text[])
      into v_changed_fields
    from (
      select n.key as k
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
      where n.value is distinct from o.value
        and n.key <> 'updated_at'
    ) changed;
  else
    v_action := 'DELETE';
    v_employee_record_id := old.id;
  end if;

  insert into public.d3_employee_audit_log (
    employee_record_id,
    action,
    actor_auth_user_id,
    actor_employee_id,
    changed_fields
  )
  values (
    v_employee_record_id,
    v_action,
    auth.uid(),
    v_actor_employee_id,
    v_changed_fields
  );

  return coalesce(new, old);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."d3_audit_employee_profile"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d3_audit_employee_profile"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."d3_audit_employee_profile"() FROM PUBLIC, "anon", "authenticated", "service_role";
