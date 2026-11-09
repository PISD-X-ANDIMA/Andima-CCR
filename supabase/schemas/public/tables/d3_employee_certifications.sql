CREATE TABLE "public"."d3_employee_certifications" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"          uuid                     NOT NULL,
  "title"                character varying(255)   NOT NULL,
  "issuing_organization" character varying(255)   NOT NULL,
  "issue_date"           date                     NOT NULL,
  "expiry_date"          date,
  "credential_id"        character varying(100),
  "created_at"           timestamp with time zone DEFAULT now(),
  CONSTRAINT "employee_certifications_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE CASCADE,
  CONSTRAINT "employee_certifications_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."d3_employee_certifications"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 employee certifications select v1" ON "public"."d3_employee_certifications"
  FOR SELECT
  TO "authenticated"
  USING (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = public.d3_current_employee_uuid())));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_certifications" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_certifications" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_employee_certifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_certifications" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_employee_certifications" FROM "anon";
