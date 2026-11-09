CREATE TABLE "public"."d1_gap_analysis_history" (
  "id"            uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"   character varying(255)      NOT NULL,
  "position_id"   uuid                        NOT NULL,
  "calculated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "calculated_by" uuid,
  CONSTRAINT "d1_gap_analysis_history_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_position_gap" FOREIGN KEY (position_id) REFERENCES public.d1_job_positions(id) ON DELETE CASCADE
);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_gap_analysis_history" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_gap_analysis_history" TO "service_role";

REVOKE ALL ON TABLE "public"."d1_gap_analysis_history" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d1_gap_analysis_history" TO "postgres";
