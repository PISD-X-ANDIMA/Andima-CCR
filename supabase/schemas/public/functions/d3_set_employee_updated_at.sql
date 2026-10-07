CREATE OR REPLACE FUNCTION public.d3_set_employee_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."d3_set_employee_updated_at"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d3_set_employee_updated_at"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."d3_set_employee_updated_at"() FROM PUBLIC, "anon", "authenticated", "service_role";
