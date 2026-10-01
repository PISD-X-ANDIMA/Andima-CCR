CREATE OR REPLACE FUNCTION public.d4_create_training_record (
  p_employee_id         uuid,
  p_development_need_id uuid,
  p_activity            text,
  p_activity_date       date,
  p_status              character varying,
  p_result              text,
  p_notes               text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare v_id uuid;
begin
  insert into public.d4_training_records (employee_id, development_need_id, activity, activity_date)
    values (p_employee_id, p_development_need_id, p_activity, p_activity_date)
    returning id into v_id;
  insert into public.d4_training_versions (training_id, revision, status, result, notes)
    values (v_id, 1, p_status, coalesce(p_result, ''), coalesce(p_notes, ''));
  return v_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."d4_create_training_record"(uuid, uuid, text, date, character varying, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."d4_create_training_record"(uuid, uuid, text, date, character varying, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d4_create_training_record"(uuid, uuid, text, date, character varying, text, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."d4_create_training_record"(uuid, uuid, text, date, character varying, text, text) FROM PUBLIC, "anon", "service_role";
