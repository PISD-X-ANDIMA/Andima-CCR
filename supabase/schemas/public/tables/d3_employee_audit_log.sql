CREATE TABLE "public"."d3_employee_audit_log" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_record_id" uuid                     NOT NULL,
  "action"             text                     NOT NULL,
  "actor_auth_user_id" uuid,
  "actor_employee_id"  uuid,
  "changed_fields"     text[]                   NOT NULL DEFAULT '{}'::text[],
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_employee_audit_log_action_check" CHECK ((action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'STATUS_CHANGE'::text, 'DELETE'::text]))),
  CONSTRAINT "d3_employee_audit_log_actor_auth_user_id_fkey" FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "d3_employee_audit_log_actor_employee_id_fkey" FOREIGN KEY (actor_employee_id) REFERENCES public.d3_employee(id) ON DELETE SET NULL,
  CONSTRAINT "d3_employee_audit_log_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."d3_employee_audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_d3_employee_audit_log_employee ON public.d3_employee_audit_log USING btree (employee_record_id, created_at DESC);

CREATE POLICY "D3 HR manager read employee audit v1" ON "public"."d3_employee_audit_log"
  FOR SELECT
  TO "authenticated"
  USING ((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_audit_log" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_audit_log" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_employee_audit_log" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_audit_log" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_employee_audit_log" FROM "anon";
