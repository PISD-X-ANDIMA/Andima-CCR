CREATE TABLE "public"."d3_employee_skills" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"       uuid                     NOT NULL,
  "competency_id"     uuid                     NOT NULL,
  "proficiency_level" integer                  NOT NULL DEFAULT 1,
  "evidence_notes"    text,
  "updated_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "employee_skills_competency_id_fkey" FOREIGN KEY (competency_id) REFERENCES public.d3_competencies(id) ON DELETE RESTRICT,
  CONSTRAINT "employee_skills_employee_id_competency_id_key" UNIQUE (employee_id, competency_id),
  CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE CASCADE,
  CONSTRAINT "employee_skills_pkey" PRIMARY KEY (id),
  CONSTRAINT "employee_skills_proficiency_level_check" CHECK (((proficiency_level >= 1) AND (proficiency_level <= 5)))
);

ALTER TABLE "public"."d3_employee_skills"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 employee skills select v1" ON "public"."d3_employee_skills"
  FOR SELECT
  TO "authenticated"
  USING (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = public.d3_current_employee_uuid())));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_skills" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_skills" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_employee_skills" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_skills" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_employee_skills" FROM "anon";
