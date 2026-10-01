CREATE TABLE "public"."d3_employee_rewards" (
  "id"          bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "employee_id" uuid                     NOT NULL,
  "reward_name" character varying        NOT NULL,
  "date"        date                     NOT NULL,
  "description" text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "d3_employee_rewards_description_not_blank_check" CHECK ((description !~ '^[[:space:]]*$'::text)),
  CONSTRAINT "d3_employee_rewards_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "d3_employee_rewards_name_not_blank_check" CHECK (((reward_name)::text !~ '^[[:space:]]*$'::text)),
  CONSTRAINT "d3_employee_rewards_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."d3_employee_rewards"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX d3_employee_rewards_employee_date_idx ON public.d3_employee_rewards USING btree (employee_id, date);

CREATE TRIGGER d3_employee_rewards_create_audit
  AFTER INSERT ON public.d3_employee_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.d3_audit_employee_reward_create();

CREATE POLICY "D3 HR creates employee rewards" ON "public"."d3_employee_rewards"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 HR reads all employee rewards" ON "public"."d3_employee_rewards"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT public.d3_current_role() AS d3_current_role) = 'HR'::public.d3_app_role));

CREATE POLICY "D3 employee reads own rewards" ON "public"."d3_employee_rewards"
  FOR SELECT
  TO "authenticated"
  USING
    (((( SELECT public.d3_current_role() AS d3_current_role) = 'EMPLOYEE'::public.d3_app_role) AND (employee_id = ( SELECT public.d3_current_employee_uuid() AS
    d3_current_employee_uuid))));

CREATE POLICY "D3 manager creates subordinate rewards" ON "public"."d3_employee_rewards"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((( SELECT public.d3_current_role() AS d3_current_role) = 'MANAGER'::public.d3_app_role) AND public.d3_is_my_subordinate(employee_id)));

CREATE POLICY "D3 manager reads subordinate rewards" ON "public"."d3_employee_rewards"
  FOR SELECT
  TO "authenticated"
  USING (((( SELECT public.d3_current_role() AS d3_current_role) = 'MANAGER'::public.d3_app_role) AND public.d3_is_my_subordinate(employee_id)));

REVOKE ALL ON TABLE "public"."d3_employee_rewards" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."d3_employee_rewards" TO "authenticated";

REVOKE ALL ON TABLE "public"."d3_employee_rewards" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee_rewards" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_employee_rewards" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."d3_employee_rewards" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_employee_rewards" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."d3_employee_rewards_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."d3_employee_rewards_id_seq" FROM "authenticated";

REVOKE ALL ON SEQUENCE "public"."d3_employee_rewards_id_seq" FROM "service_role";
