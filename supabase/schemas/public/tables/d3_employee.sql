CREATE TABLE "public"."d3_employee" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"       character varying(50)    NOT NULL,
  "full_name"         character varying(255)   NOT NULL,
  "email"             character varying(255)   NOT NULL,
  "phone"             character varying(20),
  "identity_type"     character varying(20)    DEFAULT 'KTP'::character varying,
  "identity_number"   character varying(100),
  "join_date"         date                     NOT NULL,
  "employment_status" character varying(30)    NOT NULL DEFAULT 'PROBATION'::character varying,
  "position_id"       uuid                     NOT NULL,
  "department_id"     uuid                     NOT NULL,
  "work_location"     character varying(100)   NOT NULL DEFAULT 'HQ'::character varying,
  "avatar_url"        text,
  "created_at"        timestamp with time zone DEFAULT now(),
  "updated_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "employees_department_id_fkey" FOREIGN KEY (department_id) REFERENCES public.d3_departments(id) ON DELETE RESTRICT,
  CONSTRAINT "employees_email_key" UNIQUE (email),
  CONSTRAINT "employees_employee_id_key" UNIQUE (employee_id),
  CONSTRAINT "employees_employment_status_check"
    CHECK
    (((employment_status)::text = ANY ((ARRAY['PERMANENT'::character varying, 'CONTRACT'::character varying, 'PROBATION'::character varying, 'INTERN'::character varying,
    'RESIGNED'::character varying, 'TERMINATED'::character varying])::text[]))),
  CONSTRAINT "employees_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_d3_employee_d3_departments" FOREIGN KEY (department_id) REFERENCES public.d3_departments(id) ON DELETE SET NULL,
  CONSTRAINT "employees_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.d3_positions(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."d3_employee"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_employees_employee_id ON public.d3_employee USING btree (employee_id);

CREATE TRIGGER d3_employee_profile_audit
  AFTER INSERT OR DELETE OR UPDATE ON public.d3_employee
  FOR EACH ROW
  EXECUTE FUNCTION public.d3_audit_employee_profile();

CREATE TRIGGER d3_employees_set_updated_at
  BEFORE UPDATE ON public.d3_employee
  FOR EACH ROW
  EXECUTE FUNCTION public.d3_set_employee_updated_at();

CREATE POLICY "Anyone can read employees" ON "public"."d3_employee"
  FOR SELECT
  TO "anon"
  USING (true);

CREATE POLICY "Authenticated users can read employees" ON "public"."d3_employee"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "D3 HR employee profile insert v1" ON "public"."d3_employee"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.d3_current_role() = 'HR'::public.d3_app_role));

CREATE POLICY "D3 HR employee profile update v1" ON "public"."d3_employee"
  FOR UPDATE
  TO "authenticated"
  USING ((public.d3_current_role() = 'HR'::public.d3_app_role))
  WITH CHECK ((public.d3_current_role() = 'HR'::public.d3_app_role));

CREATE POLICY "D3 employee profile select v1" ON "public"."d3_employee"
  FOR SELECT
  TO "authenticated"
  USING (((public.d3_current_role() = ANY (ARRAY['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role])) OR (id = public.d3_current_employee_uuid())));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee" TO "service_role";

REVOKE ALL ON TABLE "public"."d3_employee" FROM "anon";

GRANT SELECT ON TABLE "public"."d3_employee" TO "anon";

REVOKE ALL ON TABLE "public"."d3_employee" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."d3_employee" TO "postgres";
