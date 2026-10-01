CREATE OR REPLACE FUNCTION public.d4_create_development_need (
  p_employee_id uuid,
  p_source_type character varying,
  p_source_ref  uuid,
  p_objective   text,
  p_priority    character varying,
  p_notes       text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare v_id uuid;
begin
  insert into public.d4_development_needs (
    employee_id, source_type, position_requirement_id,
    competency_assessment_id, performance_evaluation_id, objective, priority
  ) values (
    p_employee_id, p_source_type,
    case when p_source_type = 'competency_gap' then p_source_ref end,
    case when p_source_type = 'role_change' then p_source_ref end,
    case when p_source_type = 'performance_context' then p_source_ref end,
    p_objective, p_priority
  ) returning id into v_id;
  insert into public.d4_development_need_versions (development_need_id, revision, status, notes)
    values (v_id, 1, 'Identified', coalesce(p_notes, ''));
  return v_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."d4_create_development_need"(uuid, character varying, uuid, text, character varying, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."d4_create_development_need"(uuid, character varying, uuid, text, character varying, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."d4_create_development_need"(uuid, character varying, uuid, text, character varying, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."d4_create_development_need"(uuid, character varying, uuid, text, character varying, text) FROM PUBLIC, "anon", "service_role";
