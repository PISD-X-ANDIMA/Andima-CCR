CREATE TABLE "public"."tracking_login" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id" uuid                     NOT NULL,
  "employee_id"  uuid                     NOT NULL,
  "date"         date                     NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'::text),
  "timelogin"    time without time zone   NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta'::text))::time WITHOUT time zone,
  "timelogout"   time without time zone,
  "email"        text                     NOT NULL,
  "role"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tracking_login_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT "tracking_login_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id),
  CONSTRAINT "tracking_login_pkey" PRIMARY KEY (id)
);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tracking_login" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tracking_login" TO "service_role";

REVOKE ALL ON TABLE "public"."tracking_login" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tracking_login" TO "postgres";
