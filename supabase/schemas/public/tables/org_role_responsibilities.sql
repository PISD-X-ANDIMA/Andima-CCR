CREATE TABLE "public"."org_role_responsibilities" (
  "role_code"             text                     NOT NULL,
  "department"            text                     NOT NULL,
  "position"              text                     NOT NULL,
  "function_name"         text,
  "hierarchy_level"       integer,
  "core_responsibilities" text,
  "responsibility_basis"  text,
  "review_status"         text,
  "source_file"           text                     NOT NULL DEFAULT 'OrganizationalStructureData_PTANDIMATRANSPORTINDO_UAJY_APPROVED_V1.xlsx'::text,
  "imported_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "org_role_responsibilities_pkey" PRIMARY KEY (role_code)
);

ALTER TABLE "public"."org_role_responsibilities"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX org_role_responsibilities_department_idx ON public.org_role_responsibilities USING btree (department);

CREATE INDEX org_role_responsibilities_position_idx ON public.org_role_responsibilities USING btree ("position");

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."org_role_responsibilities" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."org_role_responsibilities" TO "service_role";

COMMENT ON TABLE "public"."org_role_responsibilities" IS 'Imported role and responsibility reference data from the approved organizational structure workbook.';

REVOKE ALL ON TABLE "public"."org_role_responsibilities" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."org_role_responsibilities" TO "postgres";
