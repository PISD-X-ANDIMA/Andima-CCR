CREATE TABLE "public"."d3_user_access" (
  "auth_user_id" uuid                     NOT NULL,
  "employee_id"  uuid                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_user_access_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "d3_user_access_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_user_access_employee_id_key" UNIQUE (employee_id),
  CONSTRAINT "d3_user_access_pkey" PRIMARY KEY (auth_user_id)
);

ALTER TABLE "public"."d3_user_access"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."d3_user_access"
  ADD COLUMN "app_role" public.d3_app_role NOT NULL;

CREATE POLICY "D3 users read their own access mapping" ON "public"."d3_user_access"
  FOR SELECT
  TO "authenticated"
  USING ((auth_user_id = ( SELECT auth.uid() AS uid)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_user_access" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_user_access" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_user_access" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_user_access" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_user_access" FROM "anon";
