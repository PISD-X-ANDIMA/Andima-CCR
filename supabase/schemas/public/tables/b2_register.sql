CREATE TABLE "public"."b2_register" (
  "id"                uuid                     NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "employee_id"       character varying,
  "full_name"         character varying,
  "email"             character varying,
  "phone"             character varying,
  "employment_status" character varying,
  "position_id"       uuid                     DEFAULT gen_random_uuid(),
  "departement_id"    uuid,
  CONSTRAINT "b2_register_pkey" PRIMARY KEY (id),
  CONSTRAINT "b2_register_departement_id_fkey" FOREIGN KEY (departement_id) REFERENCES public.d3_departments(id),
  CONSTRAINT "b2_register_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.d3_positions(id)
);

ALTER TABLE "public"."b2_register"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert" ON "public"."b2_register"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "Allow anon select" ON "public"."b2_register"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."b2_register" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."b2_register" TO "service_role";

REVOKE ALL ON TABLE "public"."b2_register" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."b2_register" TO "postgres";
