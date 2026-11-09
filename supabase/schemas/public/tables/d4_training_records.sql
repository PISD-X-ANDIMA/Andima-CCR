CREATE TABLE "public"."d4_training_records" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"         uuid                     NOT NULL,
  "development_need_id" uuid                     NOT NULL,
  "activity"            text                     NOT NULL,
  "activity_date"       date                     NOT NULL,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d4_training_records_activity_check" CHECK ((length(btrim(activity)) > 0)),
  CONSTRAINT "d4_training_records_development_need_id_employee_id_fkey" FOREIGN KEY (development_need_id, employee_id) REFERENCES public.d4_development_needs(id, employee_id),
  CONSTRAINT "d4_training_records_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id),
  CONSTRAINT "d4_training_records_pkey" PRIMARY KEY (id),
  "actor_auth_user_id"  uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "d4_training_records_actor_auth_user_id_fkey" FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."d4_training_records"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d4_training_records_employee_idx ON public.d4_training_records USING btree (employee_id, activity_date DESC);

CREATE INDEX d4_training_records_need_idx ON public.d4_training_records USING btree (development_need_id);

CREATE POLICY "D4 training read permitted employee" ON "public"."d4_training_records"
  FOR SELECT
  TO "authenticated"
  USING
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = ( SELECT
    public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_training_records" TO "service_role";

ALTER TABLE "public"."d4_training_records"
  ADD COLUMN "actor_employee_id" uuid NOT NULL DEFAULT public.d3_current_employee_uuid();

ALTER TABLE "public"."d4_training_records"
  ADD CONSTRAINT "d4_training_records_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id);

CREATE POLICY "D4 training insert HR manager" ON "public"."d4_training_records"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT public.d3_current_role() AS d3_current_role) = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid()
    AS uid)) AND (actor_employee_id = ( SELECT public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

REVOKE ALL ON TABLE "public"."d4_training_records" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d4_training_records" TO "authenticated";

REVOKE ALL ON TABLE "public"."d4_training_records" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d4_training_records" TO "postgres";

REVOKE ALL ON TABLE "public"."d4_training_records" FROM "anon";
