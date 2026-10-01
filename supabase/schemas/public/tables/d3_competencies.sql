CREATE TABLE "public"."d3_competencies" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "code"       character varying(20)    NOT NULL,
  "name"       character varying(100)   NOT NULL,
  "category"   character varying(50)    DEFAULT 'Technical'::character varying,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "competencies_code_key" UNIQUE (code),
  CONSTRAINT "competencies_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."d3_competencies"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 reference competencies select v1" ON "public"."d3_competencies"
  FOR SELECT
  TO "authenticated"
  USING ((public.d3_current_role() IS NOT NULL));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_competencies" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_competencies" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_competencies" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_competencies" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_competencies" FROM "anon";
