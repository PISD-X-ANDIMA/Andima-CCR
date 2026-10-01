CREATE TABLE "public"."cargo_documentations" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"      uuid                     NOT NULL,
  "doc_type"    character varying(50)    NOT NULL,
  "file_url"    text                     NOT NULL,
  "file_name"   character varying(255),
  "file_size"   numeric(10,2),
  "uploaded_by" uuid,
  "uploaded_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "cargo_documentations_pkey" PRIMARY KEY (id),
  CONSTRAINT "cargo_documentations_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE
);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cargo_documentations" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cargo_documentations" TO "service_role";

REVOKE ALL ON TABLE "public"."cargo_documentations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cargo_documentations" TO "postgres";
