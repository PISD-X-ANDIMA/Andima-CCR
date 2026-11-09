CREATE TABLE "public"."d3_departments" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "code"       character varying(20)    NOT NULL,
  "name"       character varying(100)   NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "departments_code_key" UNIQUE (code),
  CONSTRAINT "departments_pkey" PRIMARY KEY (id)
);

CREATE POLICY "D3 reference departments select v1" ON "public"."d3_departments"
  FOR SELECT
  TO "authenticated"
  USING ((public.d3_current_role() IS NOT NULL));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_departments" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_departments" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_departments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_departments" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_departments" FROM "anon";
