CREATE TABLE "public"."org_master" (
  "employee_id"                text                     NOT NULL,
  "employee_name"              text                     NOT NULL,
  "position"                   text                     NOT NULL,
  "reports_to_id"              text,
  "reports_to_name"            text,
  "department"                 text                     NOT NULL,
  "function_name"              text,
  "team_unit"                  text,
  "hierarchy_level"            integer,
  "governance_layer"           text,
  "location"                   text,
  "employment_status"          text,
  "effective_from"             date,
  "effective_to"               date,
  "org_version"                text,
  "key_responsibilities_short" text,
  "responsibility_basis"       text,
  "review_status"              text,
  "notes"                      text,
  "source_file"                text                     NOT NULL DEFAULT 'OrganizationalStructureData_PTANDIMATRANSPORTINDO_UAJY_APPROVED_V1.xlsx'::text,
  "imported_at"                timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "org_master_effective_dates_check" CHECK (((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to >= effective_from))),
  CONSTRAINT "org_master_pkey" PRIMARY KEY (employee_id),
  CONSTRAINT "org_master_reports_to_fk" FOREIGN KEY (reports_to_id) REFERENCES public.org_master(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "org_master_reports_to_self_check" CHECK (((reports_to_id IS NULL) OR (reports_to_id <> employee_id)))
);

ALTER TABLE "public"."org_master"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX org_master_department_idx ON public.org_master USING btree (department);

CREATE INDEX org_master_position_idx ON public.org_master USING btree ("position");

CREATE INDEX org_master_reports_to_idx ON public.org_master USING btree (reports_to_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."org_master" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."org_master" TO "service_role";

COMMENT ON TABLE "public"."org_master" IS 'Imported organizational structure reference data. Existing D1-D4 master tables are intentionally not modified by this import.';

REVOKE ALL ON TABLE "public"."org_master" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."org_master" TO "postgres";
