CREATE TABLE "public"."job_issues" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"          uuid                     NOT NULL,
  "cluster_id"      uuid,
  "issue_category"  character varying(100)   NOT NULL,
  "description"     text                     NOT NULL,
  "proof_photo_url" text,
  "reported_by"     uuid,
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "job_issues_pkey" PRIMARY KEY (id),
  CONSTRAINT "job_issues_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE
);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_issues" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_issues" TO "service_role";

REVOKE ALL ON TABLE "public"."job_issues" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_issues" TO "postgres";
