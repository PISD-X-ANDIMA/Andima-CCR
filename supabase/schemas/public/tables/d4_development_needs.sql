CREATE TABLE "public"."d4_development_needs" (
  "id"                        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"               uuid                     NOT NULL,
  "source_type"               character varying(24)    NOT NULL,
  "position_requirement_id"   uuid,
  "competency_assessment_id"  uuid,
  "performance_evaluation_id" uuid,
  "objective"                 text                     NOT NULL,
  "priority"                  character varying(8)     NOT NULL,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d4_development_needs_check" CHECK (((((source_type)::text = 'competency_gap'::text) AND (position_requirement_id IS
    NOT NULL) AND (competency_assessment_id IS NULL) AND (performance_evaluation_id IS NULL)) OR
    (((source_type)::text = 'role_change'::text) AND (position_requirement_id IS NULL) AND (competency_assessment_id IS
    NOT NULL) AND (performance_evaluation_id IS NULL)) OR
    (((source_type)::text = 'performance_context'::text) AND (position_requirement_id IS NULL) AND (competency_assessment_id IS NULL) AND (performance_evaluation_id IS
    NOT NULL)))),
  CONSTRAINT "d4_development_needs_competency_assessment_id_employee_id_fkey" FOREIGN KEY (competency_assessment_id, employee_id)
    REFERENCES public.d4_competency_assessments(id, employee_id),
  CONSTRAINT "d4_development_needs_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id),
  CONSTRAINT "d4_development_needs_id_employee_id_key" UNIQUE (id, employee_id),
  CONSTRAINT "d4_development_needs_objective_check" CHECK ((length(btrim(objective)) > 0)),
  CONSTRAINT "d4_development_needs_pkey" PRIMARY KEY (id),
  CONSTRAINT "d4_development_needs_priority_check"
    CHECK (((priority)::text = ANY ((ARRAY['Low'::character varying, 'Medium'::character varying, 'High'::character varying])::text[]))),
  CONSTRAINT "d4_development_needs_source_type_check"
    CHECK (((source_type)::text = ANY ((ARRAY['competency_gap'::character varying, 'role_change'::character varying, 'performance_context'::character varying])::text[]))),
  CONSTRAINT "d4_development_needs_performance_evaluation_id_employee_id_fkey" FOREIGN KEY (performance_evaluation_id, employee_id)
    REFERENCES public.d4_performance_evaluations(id, employee_id),
  CONSTRAINT "d4_development_needs_position_requirement_id_fkey" FOREIGN KEY (position_requirement_id) REFERENCES public.position_requirements(id),
  "actor_auth_user_id"        uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "d4_development_needs_actor_auth_user_id_fkey" FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."d4_development_needs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d4_development_needs_assessment_idx ON public.d4_development_needs USING btree (competency_assessment_id)
  WHERE (competency_assessment_id IS NOT NULL);

CREATE INDEX d4_development_needs_employee_idx ON public.d4_development_needs USING btree (employee_id, created_at DESC);

CREATE INDEX d4_development_needs_evaluation_idx ON public.d4_development_needs USING btree (performance_evaluation_id)
  WHERE (performance_evaluation_id IS NOT NULL);

CREATE INDEX d4_development_needs_requirement_idx ON public.d4_development_needs USING btree (position_requirement_id)
  WHERE (position_requirement_id IS NOT NULL);

CREATE POLICY "D4 development read permitted employee" ON "public"."d4_development_needs"
  FOR SELECT
  TO "authenticated"
  USING
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = ( SELECT
    public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_development_needs" TO "service_role";

ALTER TABLE "public"."d4_development_needs"
  ADD COLUMN "actor_employee_id" uuid NOT NULL DEFAULT public.d3_current_employee_uuid();

ALTER TABLE "public"."d4_development_needs"
  ADD CONSTRAINT "d4_development_needs_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id);

CREATE POLICY "D4 development insert HR manager" ON "public"."d4_development_needs"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid()
    AS uid)) AND (actor_employee_id = ( SELECT public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

REVOKE ALL ON TABLE "public"."d4_development_needs" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d4_development_needs" TO "authenticated";

REVOKE ALL ON TABLE "public"."d4_development_needs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_development_needs" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_development_needs" FROM "anon";
