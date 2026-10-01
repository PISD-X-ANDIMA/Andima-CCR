CREATE TABLE "public"."d1_kpi_definitions" (
  "id"          uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "position_id" uuid                        NOT NULL,
  "kpi_name"    character varying(150)      NOT NULL,
  "kpi_target"  character varying(255)      NOT NULL,
  "kpi_weight"  integer                     NOT NULL,
  "is_active"   boolean                     NOT NULL DEFAULT true,
  "metadata"    jsonb,
  "created_at"  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "created_by"  uuid,
  CONSTRAINT "d1_kpi_definitions_kpi_name_check" CHECK (((char_length((kpi_name)::text) >= 3) AND ((kpi_name)::text ~ '^[a-zA-Z0-9\s\-\_]+$'::text))),
  CONSTRAINT "d1_kpi_definitions_kpi_target_check" CHECK ((char_length((kpi_target)::text) >= 1)),
  CONSTRAINT "d1_kpi_definitions_kpi_weight_check" CHECK (((kpi_weight >= 1) AND (kpi_weight <= 100))),
  CONSTRAINT "d1_kpi_definitions_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_position_kpi" FOREIGN KEY (position_id) REFERENCES public.d1_job_positions(id) ON DELETE CASCADE,
  CONSTRAINT "unique_kpi_per_position" UNIQUE (position_id, kpi_name)
);

CREATE POLICY "Enable read access for all users" ON "public"."d1_kpi_definitions"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_kpi_definitions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_kpi_definitions" TO "service_role";

REVOKE ALL ON TABLE "public"."d1_kpi_definitions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_kpi_definitions" TO "postgres";
