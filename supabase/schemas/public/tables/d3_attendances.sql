CREATE TABLE "public"."d3_attendances" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" uuid                     NOT NULL,
  "date"        date                     NOT NULL DEFAULT CURRENT_DATE,
  "clock_in"    timestamp with time zone NOT NULL,
  "clock_out"   timestamp with time zone,
  "status"      character varying(20)    DEFAULT 'PRESENT'::character varying,
  "notes"       text,
  "created_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "attendances_employee_id_date_key" UNIQUE (employee_id, date),
  CONSTRAINT "attendances_pkey" PRIMARY KEY (id),
  CONSTRAINT "attendances_status_check"
    CHECK (((status)::text = ANY ((ARRAY['PRESENT'::character varying, 'LATE'::character varying, 'ABSENT'::character varying, 'ON_LEAVE'::character varying])::text[]))),
  CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE RESTRICT,
  CONSTRAINT "fk_d3_attendances_d3_employee" FOREIGN KEY (employee_id) REFERENCES public.d3_employee(id) ON DELETE CASCADE
);

CREATE POLICY "D3 attendance select v1" ON "public"."d3_attendances"
  FOR SELECT
  TO "authenticated"
  USING (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (employee_id = public.d3_current_employee_uuid())));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_attendances" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_attendances" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_attendances" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_attendances" TO "postgres";

REVOKE ALL ON TABLE "public"."d3_attendances" FROM "anon";
