CREATE TABLE "public"."d3_employee_reporting" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "manager_employee_id"     uuid                     NOT NULL,
  "subordinate_employee_id" uuid                     NOT NULL,
  "effective_from"          date                     NOT NULL DEFAULT CURRENT_DATE,
  "effective_to"            date,
  "is_active"               boolean                  NOT NULL DEFAULT true,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_employee_reporting_manager_employee_id_fkey" FOREIGN KEY (manager_employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_employee_reporting_not_self_reference_check" CHECK ((manager_employee_id <> subordinate_employee_id)),
  CONSTRAINT "d3_employee_reporting_pkey" PRIMARY KEY (id),
  CONSTRAINT "d3_employee_reporting_subordinate_employee_id_fkey" FOREIGN KEY (subordinate_employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_employee_reporting_valid_period_check" CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)))
);

ALTER TABLE "public"."d3_employee_reporting"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d3_employee_reporting_manager_active_idx ON public.d3_employee_reporting USING btree (manager_employee_id, is_active);

CREATE INDEX d3_employee_reporting_subordinate_active_idx ON public.d3_employee_reporting USING btree (subordinate_employee_id, is_active);

CREATE UNIQUE INDEX d3_employee_reporting_unique_active_pair_idx ON public.d3_employee_reporting USING btree (manager_employee_id, subordinate_employee_id)
  WHERE (is_active = true);

CREATE TRIGGER d3_employee_reporting_set_updated_at
  BEFORE UPDATE ON public.d3_employee_reporting
  FOR EACH ROW
  EXECUTE FUNCTION public.d3_set_employee_updated_at();

CREATE POLICY "D3 HR creates employee reporting" ON "public"."d3_employee_reporting"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 HR deletes employee reporting" ON "public"."d3_employee_reporting"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 HR reads all employee reporting" ON "public"."d3_employee_reporting"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 HR updates employee reporting" ON "public"."d3_employee_reporting"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role))
  WITH CHECK ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 manager reads own employee reporting" ON "public"."d3_employee_reporting"
  FOR SELECT
  TO "authenticated"
  USING
    (((( SELECT public.d3_current_role() AS d3_current_role) = 'MANAGER'::public.d3_app_role) AND (manager_employee_id = ( SELECT public.d3_current_employee_uuid() AS
    d3_current_employee_uuid)) AND (is_active = true) AND (effective_from <= CURRENT_DATE) AND ((effective_to IS NULL) OR (effective_to >= CURRENT_DATE))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_reporting" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_reporting" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_employee_reporting" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_reporting" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_employee_reporting" FROM "anon";
