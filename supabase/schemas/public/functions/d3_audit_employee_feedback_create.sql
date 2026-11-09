CREATE OR REPLACE FUNCTION public.d3_audit_employee_feedback_create()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.d3_feedback_reward_audit_log (
    entity_type,
    entity_id,
    target_employee_id,
    action,
    actor_auth_user_id,
    actor_employee_id
  )
  values (
    'FEEDBACK',
    new.id,
    new.employee_id,
    'CREATE',
    auth.uid(),
    public.d3_current_employee_uuid()
  );

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."d3_audit_employee_feedback_create"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d3_audit_employee_feedback_create"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."d3_audit_employee_feedback_create"() FROM PUBLIC, "anon", "authenticated", "service_role";
