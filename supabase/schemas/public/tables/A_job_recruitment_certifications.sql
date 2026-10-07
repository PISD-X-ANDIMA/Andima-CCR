CREATE TABLE "public"."A_job_recruitment_certifications" (
  "job_recruitment_id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "certification_title"        character varying,
  "issuing_organization"       character varying,
  "is_mandatory"               boolean,
  "min_validity_period_months" bigint,
  "created_at"                 timestamp with time zone,
  CONSTRAINT "A_job_recruitment_certifications_pkey" PRIMARY KEY (job_recruitment_id)
);

ALTER TABLE "public"."A_job_recruitment_certifications"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."A_job_recruitment_certifications" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."A_job_recruitment_certifications" TO "anon";

REVOKE ALL ON TABLE "public"."A_job_recruitment_certifications" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."A_job_recruitment_certifications" TO "authenticated";

REVOKE ALL ON TABLE "public"."A_job_recruitment_certifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."A_job_recruitment_certifications" TO "postgres";

REVOKE ALL ON TABLE "public"."A_job_recruitment_certifications" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."A_job_recruitment_certifications" TO "service_role";
