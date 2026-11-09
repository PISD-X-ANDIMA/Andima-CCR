CREATE TABLE "public"."d4_competency_assessments" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"             uuid                     NOT NULL,
  "position_id"             uuid                     NOT NULL,
  "position_title_snapshot" text                     NOT NULL,
  "effective_date"          date                     NOT NULL,
  "context"                 character varying(24)    NOT NULL,
  "overall_status"          character varying(32)    NOT NULL,
  "findings"                jsonb                    NOT NULL,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d4_competency_assessments_context_check" CHECK (((context)::text = ANY ((ARRAY['current-position'::character varying, 'role-change'::character varying])::text[]))),
  CONSTRAINT "d4_competency_assessments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id),
  CONSTRAINT "d4_competency_assessments_findings_check" CHECK ((jsonb_typeof(findings) = 'array'::text)),
  CONSTRAINT "d4_competency_assessments_id_employee_id_key" UNIQUE (id, employee_id),
  CONSTRAINT "d4_competency_assessments_overall_status_check"
    CHECK
    (((overall_status)::text = ANY ((ARRAY['Terpenuhi'::character varying, 'Gap'::character varying, 'Bukti Belum Cukup'::character varying, 'Belum Ada Persyaratan'::character
    varying])::text[]))),
  CONSTRAINT "d4_competency_assessments_pkey" PRIMARY KEY (id),
  CONSTRAINT "d4_competency_assessments_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.d3_positions(id),
  "actor_auth_user_id"      uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "d4_competency_assessments_actor_auth_user_id_fkey" FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."d4_competency_assessments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d4_competency_employee_date_idx ON public.d4_competency_assessments USING btree (employee_id, effective_date DESC, created_at DESC);

CREATE POLICY "D4 competency read permitted employee" ON "public"."d4_competency_assessments"
  FOR SELECT
  TO "authenticated"
  USING
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = ( SELECT
    public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_competency_assessments" TO "service_role";

ALTER TABLE "public"."d4_competency_assessments"
  ADD COLUMN "actor_employee_id" uuid NOT NULL DEFAULT public.d3_current_employee_uuid();

ALTER TABLE "public"."d4_competency_assessments"
  ADD CONSTRAINT "d4_competency_assessments_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id);

CREATE POLICY "D4 competency insert HR manager" ON "public"."d4_competency_assessments"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid()
    AS uid)) AND (actor_employee_id = ( SELECT public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

REVOKE ALL ON TABLE "public"."d4_competency_assessments" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d4_competency_assessments" TO "authenticated";

REVOKE ALL ON TABLE "public"."d4_competency_assessments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_competency_assessments" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_competency_assessments" FROM "anon";
