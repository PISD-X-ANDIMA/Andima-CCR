CREATE TABLE "public"."d1_position_competency_map" (
  "position_id"   uuid    NOT NULL,
  "competency_id" uuid    NOT NULL,
  "minimum_level" integer NOT NULL,
  "is_required"   boolean DEFAULT true,
  CONSTRAINT "d1_position_competency_map_minimum_level_check" CHECK (((minimum_level >= 1) AND (minimum_level <= 5))),
  CONSTRAINT "d1_position_competency_map_pkey" PRIMARY KEY (position_id, competency_id),
  CONSTRAINT "fk_position_comp" FOREIGN KEY (position_id) REFERENCES public.d1_job_positions(id) ON DELETE CASCADE
);

CREATE POLICY "Enable read access for all users" ON "public"."d1_position_competency_map"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_position_competency_map" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_position_competency_map" TO "service_role";

REVOKE ALL ON TABLE "public"."d1_position_competency_map" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_position_competency_map" TO "postgres";
