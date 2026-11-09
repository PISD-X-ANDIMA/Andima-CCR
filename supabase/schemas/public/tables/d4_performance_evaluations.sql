CREATE TABLE "public"."d4_performance_evaluations" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"             uuid                     NOT NULL,
  "position_id"             uuid                     NOT NULL,
  "position_title_snapshot" text                     NOT NULL,
  "period"                  character varying(7)     NOT NULL,
  "evaluation_date"         date,
  "evaluator_name_snapshot" text                     NOT NULL DEFAULT ''::text,
  "status"                  character varying(16)    NOT NULL,
  "review_status"           character varying(32)    NOT NULL,
  "overall_score"           numeric(3,2),
  "aspects"                 jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "general_notes"           text                     NOT NULL DEFAULT ''::text,
  "evidence_reference"      text,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d4_performance_evaluations_aspects_check" CHECK ((jsonb_typeof(aspects) = 'array'::text)),
  CONSTRAINT "d4_performance_evaluations_check" CHECK ((((status)::text <> 'completed'::text) OR ((evaluation_date IS
    NOT NULL) AND (length(btrim(evaluator_name_snapshot)) > 0) AND (overall_score IS NOT NULL) AND (length(btrim(general_notes)) > 0)))),
  CONSTRAINT "d4_performance_evaluations_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id),
  CONSTRAINT "d4_performance_evaluations_id_employee_id_key" UNIQUE (id, employee_id),
  CONSTRAINT "d4_performance_evaluations_overall_score_check" CHECK (((overall_score >= (1)::numeric) AND (overall_score <= (5)::numeric))),
  CONSTRAINT "d4_performance_evaluations_period_check" CHECK (((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)),
  CONSTRAINT "d4_performance_evaluations_pkey" PRIMARY KEY (id),
  CONSTRAINT "d4_performance_evaluations_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.d3_positions(id),
  CONSTRAINT "d4_performance_evaluations_review_status_check"
    CHECK (((review_status)::text = ANY ((ARRAY['Needs Review'::character varying, 'On Track'::character varying, 'Needs Attention'::character varying])::text[]))),
  CONSTRAINT "d4_performance_evaluations_status_check" CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'completed'::character varying])::text[]))),
  "actor_auth_user_id"      uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "d4_performance_evaluations_actor_auth_user_id_fkey" FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."d4_performance_evaluations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d4_performance_employee_period_idx ON public.d4_performance_evaluations USING btree (employee_id, period, created_at DESC);

CREATE POLICY "D4 performance read permitted employee" ON "public"."d4_performance_evaluations"
  FOR SELECT
  TO "authenticated"
  USING
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = ( SELECT
    public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_performance_evaluations" TO "service_role";

ALTER TABLE "public"."d4_performance_evaluations"
  ADD COLUMN "actor_employee_id" uuid NOT NULL DEFAULT public.d3_current_employee_uuid();

ALTER TABLE "public"."d4_performance_evaluations"
  ADD CONSTRAINT "d4_performance_evaluations_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id);

CREATE POLICY "D4 performance insert HR manager" ON "public"."d4_performance_evaluations"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid()
    AS uid)) AND (actor_employee_id = ( SELECT public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

REVOKE ALL ON TABLE "public"."d4_performance_evaluations" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d4_performance_evaluations" TO "authenticated";

REVOKE ALL ON TABLE "public"."d4_performance_evaluations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_performance_evaluations" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_performance_evaluations" FROM "anon";
