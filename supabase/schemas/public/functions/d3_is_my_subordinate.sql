CREATE OR REPLACE FUNCTION public.d3_is_my_subordinate (
  target_employee_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.d3_employee_reporting as reporting
    where reporting.manager_employee_id = public.d3_current_employee_uuid()
      and reporting.subordinate_employee_id = target_employee_id
      and reporting.is_active = true
      and reporting.effective_from <= current_date
      and (
        reporting.effective_to is null
        or reporting.effective_to >= current_date
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."d3_is_my_subordinate"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."d3_is_my_subordinate"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d3_is_my_subordinate"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."d3_is_my_subordinate"(uuid) FROM PUBLIC, "anon", "service_role";
