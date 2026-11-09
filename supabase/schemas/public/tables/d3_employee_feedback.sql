CREATE TABLE "public"."d3_employee_feedback" (
  "id"            bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "employee_id"   uuid                     NOT NULL,
  "given_by"      uuid                     NOT NULL,
  "date"          date                     NOT NULL,
  "feedback_text" text                     NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_employee_feedback_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_employee_feedback_given_by_fkey" FOREIGN KEY (given_by) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_employee_feedback_pkey" PRIMARY KEY (id),
  CONSTRAINT "d3_employee_feedback_text_not_blank_check" CHECK ((feedback_text !~ '^[[:space:]]*$'::text))
);

ALTER TABLE "public"."d3_employee_feedback"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d3_employee_feedback_employee_date_idx ON public.d3_employee_feedback USING btree (employee_id, date);

CREATE INDEX d3_employee_feedback_given_by_date_idx ON public.d3_employee_feedback USING btree (given_by, date);

CREATE TRIGGER d3_employee_feedback_create_audit
  AFTER INSERT ON public.d3_employee_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.d3_audit_employee_feedback_create();

CREATE POLICY "D3 HR creates employee feedback" ON "public"."d3_employee_feedback"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role) AND (given_by = ( SELECT public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

CREATE POLICY "D3 HR reads all employee feedback" ON "public"."d3_employee_feedback"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 employee reads own feedback" ON "public"."d3_employee_feedback"
  FOR SELECT
  TO "authenticated"
  USING
    (((( SELECT public.d3_current_role() AS d3_current_role) = 'EMPLOYEE'::public.d3_app_role) AND (employee_id = ( SELECT public.d3_current_employee_uuid() AS
    d3_current_employee_uuid))));

CREATE POLICY "D3 manager creates subordinate feedback" ON "public"."d3_employee_feedback"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT public.d3_current_role() AS d3_current_role) = 'MANAGER'::public.d3_app_role) AND public.d3_is_my_subordinate(employee_id) AND (given_by = ( SELECT
    public.d3_current_employee_uuid() AS d3_current_employee_uuid))));

CREATE POLICY "D3 manager reads subordinate feedback" ON "public"."d3_employee_feedback"
  FOR SELECT
  TO "authenticated"
  USING (((( SELECT public.d3_current_role() AS d3_current_role) = 'MANAGER'::public.d3_app_role) AND public.d3_is_my_subordinate(employee_id)));

REVOKE ALL ON TABLE "public"."d3_employee_feedback" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d3_employee_feedback" TO "authenticated";

REVOKE ALL ON TABLE "public"."d3_employee_feedback" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_feedback" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_employee_feedback" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."d3_employee_feedback" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_employee_feedback" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."d3_employee_feedback_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."d3_employee_feedback_id_seq" FROM "authenticated";

REVOKE ALL ON SEQUENCE "public"."d3_employee_feedback_id_seq" FROM "service_role";
