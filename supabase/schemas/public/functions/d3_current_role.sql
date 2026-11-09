CREATE OR REPLACE FUNCTION public.d3_current_role()
  RETURNS public.d3_app_role
  LANGUAGE sql
  STABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  select dua.app_role
  from public.d3_user_access dua
  where dua.auth_user_id = auth.uid()
  limit 1
$function$;

GRANT EXECUTE ON FUNCTION "public"."d3_current_role"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."d3_current_role"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d3_current_role"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."d3_current_role"() FROM "anon", "authenticated", "service_role";
