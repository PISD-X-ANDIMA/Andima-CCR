CREATE OR REPLACE FUNCTION private.d3_populate_ticket_reporter_snapshot()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  select employee.full_name, employee.employee_id, coalesce(department.name, '-')
    into new.reporter_name, new.reporter_employee_code, new.reporter_department
  from public.d3_user_access access
  join public.employees employee on employee.id = access.employee_id
  left join public.departments department on department.id = employee.department_id
  where access.auth_user_id = auth.uid()
    and access.employee_id = new.employee_id;

  if new.reporter_name is null then
    raise exception 'Authenticated employee mapping is required to create a D3 ticket';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."d3_populate_ticket_reporter_snapshot"() FROM PUBLIC;
