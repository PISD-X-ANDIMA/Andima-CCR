CREATE TABLE "public"."position_requirements" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "position_id"           uuid                     NOT NULL,
  "competency_id"         uuid                     NOT NULL,
  "min_proficiency_level" integer                  NOT NULL DEFAULT 1,
  "is_mandatory"          boolean                  DEFAULT true,
  "created_at"            timestamp with time zone DEFAULT now(),
  CONSTRAINT "position_requirements_competency_id_fkey" FOREIGN KEY (competency_id) REFERENCES public.d3_competencies(id) ON DELETE RESTRICT,
  CONSTRAINT "position_requirements_min_proficiency_level_check" CHECK (((min_proficiency_level >= 1) AND (min_proficiency_level <= 5))),
  CONSTRAINT "position_requirements_pkey" PRIMARY KEY (id),
  CONSTRAINT "position_requirements_position_id_competency_id_key" UNIQUE (position_id, competency_id),
  CONSTRAINT "position_requirements_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.d3_positions(id) ON DELETE CASCADE
);

ALTER TABLE "public"."position_requirements"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 reference position requirements select v1" ON "public"."position_requirements"
  FOR SELECT
  TO "authenticated"
  USING ((public.d3_current_role() IS NOT NULL));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."position_requirements" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."position_requirements" TO "service_role";

REVOKE ALL ON TABLE "public"."position_requirements" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."position_requirements" TO "postgres";

REVOKE ALL ON TABLE "public"."position_requirements" FROM "anon";
