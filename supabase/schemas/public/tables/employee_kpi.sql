CREATE TABLE "public"."employee_kpi" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid                     NOT NULL,
  "period"      character varying(20)    NOT NULL,
  "kpi_score"   numeric(5,2)             NOT NULL,
  "notes"       text,
  "created_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "employee_kpi_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE CASCADE,
  CONSTRAINT "employee_kpi_kpi_score_check" CHECK (((kpi_score >= (0)::numeric) AND (kpi_score <= (100)::numeric))),
  CONSTRAINT "employee_kpi_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."employee_kpi"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 employee KPI select v1" ON "public"."employee_kpi"
  FOR SELECT
  TO "authenticated"
  USING (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = public.d3_current_employee_uuid())));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."employee_kpi" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."employee_kpi" TO "service_role";

REVOKE ALL ON TABLE "public"."employee_kpi" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."employee_kpi" TO "postgres";

REVOKE ALL ON TABLE "public"."employee_kpi" FROM "anon";
