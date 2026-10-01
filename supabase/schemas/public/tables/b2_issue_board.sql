CREATE TABLE "public"."b2_issue_board" (
  "employee_certification_id"        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_recruitment_certification_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "issue_type"                       character varying,
  "title"                            character varying,
  "description"                      text,
  "status"                           character varying,
  "priority"                         character varying,
  "assigned_to"                      uuid                     DEFAULT gen_random_uuid(),
  "due_date"                         date,
  "created_at"                       timestamp with time zone,
  "updated_at"                       timestamp with time zone,
  CONSTRAINT "b2_issue_board_pkey" PRIMARY KEY (employee_certification_id)
);

ALTER TABLE "public"."b2_issue_board"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."b2_issue_board" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."b2_issue_board" TO "anon";

REVOKE ALL ON TABLE "public"."b2_issue_board" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."b2_issue_board" TO "authenticated";

REVOKE ALL ON TABLE "public"."b2_issue_board" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."b2_issue_board" TO "postgres";

REVOKE ALL ON TABLE "public"."b2_issue_board" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."b2_issue_board" TO "service_role";
