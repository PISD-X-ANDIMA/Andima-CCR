CREATE OR REPLACE FUNCTION public.d3_current_employee_uuid()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  select dua.employee_id
  from public.d3_user_access dua
  where dua.auth_user_id = auth.uid()
  limit 1
$function$;

GRANT EXECUTE ON FUNCTION "public"."d3_current_employee_uuid"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."d3_current_employee_uuid"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d3_current_employee_uuid"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."d3_current_employee_uuid"() FROM "anon", "authenticated", "service_role";
