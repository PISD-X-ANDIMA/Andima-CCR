CREATE TABLE "public"."d4_kpi_assessments" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"        uuid                     NOT NULL,
  "role_order"         integer                  NOT NULL,
  "role_name"          text                     NOT NULL,
  "period"             character varying(7)     NOT NULL,
  "evaluation_date"    date,
  "evaluator_name"     text                     NOT NULL DEFAULT ''::text,
  "status"             character varying(16)    NOT NULL,
  "lines"              jsonb                    NOT NULL,
  "overall_score"      numeric(3,2),
  "general_notes"      text                     NOT NULL DEFAULT ''::text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d4_kpi_assessments_check" CHECK ((((status)::text <> 'completed'::text) OR ((evaluation_date IS
    NOT NULL) AND (length(btrim(evaluator_name)) > 0) AND (overall_score IS NOT NULL)))),
  CONSTRAINT "d4_kpi_assessments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id),
  CONSTRAINT "d4_kpi_assessments_lines_check" CHECK (((jsonb_typeof(lines) = 'array'::text) AND (jsonb_array_length(lines) = 5))),
  CONSTRAINT "d4_kpi_assessments_overall_score_check" CHECK (((overall_score >= (1)::numeric) AND (overall_score <= (5)::numeric))),
  CONSTRAINT "d4_kpi_assessments_period_check" CHECK (((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)),
  CONSTRAINT "d4_kpi_assessments_pkey" PRIMARY KEY (id),
  CONSTRAINT "d4_kpi_assessments_role_order_check" CHECK (((role_order >= 1) AND (role_order <= 10))),
  CONSTRAINT "d4_kpi_assessments_status_check" CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'completed'::character varying])::text[]))),
  "actor_auth_user_id" uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "d4_kpi_assessments_actor_auth_user_id_fkey" FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."d4_kpi_assessments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d4_kpi_assessments_employee_period_idx ON public.d4_kpi_assessments USING btree (employee_id, period, created_at DESC);

CREATE TRIGGER d4_kpi_assessments_calculate
  BEFORE INSERT ON public.d4_kpi_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.d4_calculate_kpi_assessment();

CREATE POLICY "D4 KPI assessment read permitted employee" ON "public"."d4_kpi_assessments"
  FOR SELECT
  TO "authenticated"
  USING (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = public.d3_current_employee_uuid())));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_kpi_assessments" TO "service_role";

ALTER TABLE "public"."d4_kpi_assessments"
  ADD COLUMN "actor_employee_id" uuid NOT NULL DEFAULT public.d3_current_employee_uuid();

ALTER TABLE "public"."d4_kpi_assessments"
  ADD CONSTRAINT "d4_kpi_assessments_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id);

CREATE POLICY "D4 KPI assessment insert HR manager" ON "public"."d4_kpi_assessments"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) AND (actor_auth_user_id = auth.uid()) AND (actor_employee_id =
    public.d3_current_employee_uuid())));

REVOKE ALL ON TABLE "public"."d4_kpi_assessments" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d4_kpi_assessments" TO "authenticated";

REVOKE ALL ON TABLE "public"."d4_kpi_assessments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_kpi_assessments" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_kpi_assessments" FROM "anon";
