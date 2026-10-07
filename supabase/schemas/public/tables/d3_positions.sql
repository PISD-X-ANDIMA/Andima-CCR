CREATE TABLE "public"."d3_positions" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "code"          character varying(20)    NOT NULL,
  "title"         character varying(100)   NOT NULL,
  "department_id" uuid,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "positions_code_key" UNIQUE (code),
  CONSTRAINT "positions_department_id_fkey" FOREIGN KEY (department_id) REFERENCES public.d3_departments(id) ON DELETE SET NULL,
  CONSTRAINT "positions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."d3_positions"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "D3 reference positions select v1" ON "public"."d3_positions"
  FOR SELECT
  TO "authenticated"
  USING ((public.d3_current_role() IS NOT NULL));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_positions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_positions" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_positions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_positions" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_positions" FROM "anon";
